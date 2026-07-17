import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

import { BookingsService } from './bookings.service';
import { Booking, BookingSchema, BookingDocument } from './schemas/booking.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { ServicesService } from '../services/services.service';
import { SettingsService } from '../settings/settings.service';
import { RazorpayService } from '../payments/razorpay.service';
import { WalletService } from '../wallet/wallet.service';
import { LeadsService } from '../leads/leads.service';
import { OrderStatus } from '../../common/enums/order-status.enum';

/**
 * Payment-correctness tests for bookings — against a REAL (in-memory) MongoDB,
 * because the guarantee under test (idempotent confirmation) is enforced by an
 * atomic conditional update, which a mocked model would not exercise.
 *
 * Covers the ways an order can take money and get it wrong:
 *   1. A replayed Razorpay webhook double-confirming an order
 *   2. Two webhooks arriving at once
 *   3. Final settlement being paid twice, or over-paid
 */
describe('BookingsService (payment correctness)', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: BookingsService;
  let bookingModel: Model<BookingDocument>;

  const userId = new Types.ObjectId().toHexString();

  // Only the collaborators these code paths actually touch need real behaviour.
  const walletMock = { debit: jest.fn().mockResolvedValue(0) };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Booking.name, schema: BookingSchema },
          { name: Counter.name, schema: CounterSchema },
        ]),
      ],
      providers: [
        BookingsService,
        // Resolves to [] by default: the catalog knows none of the throwaway
        // ObjectIds the date tests post, which is exactly what they rely on —
        // create() gets PAST the date check and then fails on the service lookup.
        { provide: ServicesService, useValue: { findActiveByIds: jest.fn().mockResolvedValue([]) } },
        { provide: SettingsService, useValue: { getAdvanceAmount: jest.fn().mockResolvedValue(49) } },
        { provide: RazorpayService, useValue: { isLive: false, keyId: '' } },
        { provide: WalletService, useValue: walletMock },
        { provide: LeadsService, useValue: { markConvertedIfPending: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = moduleRef.get(BookingsService);
    bookingModel = moduleRef.get(getModelToken(Booking.name));
  }, 60000);

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await bookingModel.deleteMany({});
    jest.clearAllMocks();
  });

  /** An order awaiting its advance payment via Razorpay. */
  const makePendingOrder = async (razorpayOrderId: string, opts?: { total?: number; advance?: number }) =>
    bookingModel.create({
      orderNumber: 'MV-00001',
      user: new Types.ObjectId(userId),
      items: [{ service: new Types.ObjectId(), name: 'Deep Cleaning', price: opts?.total ?? 1499 }],
      scheduledDate: '2026-08-01',
      timeSlot: '10:00-12:00',
      address: 'Test address, Bengaluru',
      pincode: '560001',
      totalAmount: opts?.total ?? 1499,
      advanceAmount: opts?.advance ?? 49,
      advancePaid: false,
      status: OrderStatus.PENDING,
      razorpayOrderId,
    });

  describe('bookable date window', () => {
    const isoIn = (days: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const dto = (scheduledDate: string) => ({
      serviceIds: [new Types.ObjectId().toHexString()],
      scheduledDate,
      timeSlot: '10:00-12:00',
      address: '12 MG Road, Bengaluru',
      pincode: '560001',
    });

    it('rejects a date in the past', async () => {
      await expect(service.create(userId, dto(isoIn(-10)) as any)).rejects.toThrow(
        /already passed/,
      );
    });

    it('rejects an absurd far-future date', async () => {
      await expect(service.create(userId, dto('2099-12-31') as any)).rejects.toThrow(
        /up to 60 days ahead/,
      );
    });

    it('rejects a date that is not real (e.g. 31 February)', async () => {
      await expect(service.create(userId, dto('2026-02-31') as any)).rejects.toThrow(
        /not a real date/,
      );
    });

    it('allows today', async () => {
      // Gets past the date check, then fails later on the unknown service id —
      // proving the date itself was accepted.
      await expect(service.create(userId, dto(isoIn(0)) as any)).rejects.toThrow(
        /services are unavailable/,
      );
    });

    it('allows a date inside the window', async () => {
      await expect(service.create(userId, dto(isoIn(30)) as any)).rejects.toThrow(
        /services are unavailable/,
      );
    });
  });

  describe('indexes', () => {
    it('indexes razorpayOrderId — the payment webhook lookup key', async () => {
      // Every Razorpay webhook resolves a booking by razorpayOrderId. Without an
      // index that is a full collection scan on the payment path, degrading as
      // orders accumulate — exactly when Razorpay starts retrying slow hooks.
      // This test exists so nobody quietly removes it.
      await bookingModel.init(); // ensure declared indexes are built
      const indexes = await bookingModel.collection.indexes();
      const indexedFields = indexes.map((i) => Object.keys(i.key).join(','));

      expect(indexedFields).toContain('razorpayOrderId');
    });
  });

  describe('confirmAdvanceByRazorpayOrder (webhook replay)', () => {
    it('confirms the order on the first webhook', async () => {
      await makePendingOrder('order_ABC');

      const applied = await service.confirmAdvanceByRazorpayOrder('order_ABC', 'pay_123');

      expect(applied).toBe(true);
      const order = await bookingModel.findOne({ razorpayOrderId: 'order_ABC' });
      expect(order!.advancePaid).toBe(true);
      expect(order!.status).toBe(OrderStatus.CONFIRMED);
      expect(order!.razorpayPaymentId).toBe('pay_123');
    });

    it('IDEMPOTENT: a replayed webhook does not re-confirm or overwrite the payment id', async () => {
      await makePendingOrder('order_ABC');

      const first = await service.confirmAdvanceByRazorpayOrder('order_ABC', 'pay_123');
      const second = await service.confirmAdvanceByRazorpayOrder('order_ABC', 'pay_DUPLICATE');

      expect(first).toBe(true);
      expect(second).toBe(false); // already paid — no-op

      const order = await bookingModel.findOne({ razorpayOrderId: 'order_ABC' });
      // The original payment id must survive a replay carrying a different one.
      expect(order!.razorpayPaymentId).toBe('pay_123');
      expect(order!.status).toBe(OrderStatus.CONFIRMED);
    });

    it('IDEMPOTENT under concurrency: simultaneous webhooks confirm only once', async () => {
      await makePendingOrder('order_RACE');

      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          service.confirmAdvanceByRazorpayOrder('order_RACE', `pay_${i}`),
        ),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('ignores an unknown Razorpay order id', async () => {
      const applied = await service.confirmAdvanceByRazorpayOrder('order_UNKNOWN', 'pay_x');
      expect(applied).toBe(false);
    });
  });

  describe('payFinal (settlement)', () => {
    const confirmedOrder = async () => {
      const order = await makePendingOrder('order_PAID', { total: 1499, advance: 49 });
      order.advancePaid = true;
      order.status = OrderStatus.CONFIRMED;
      await order.save();
      return order;
    };

    it('splits the balance between wallet and cash', async () => {
      const order = await confirmedOrder();
      // 1499 total - 49 advance = 1450 due. Pay 450 from wallet, 1000 cash.
      const view = await service.payFinal(userId, order.id, 450);

      expect(walletMock.debit).toHaveBeenCalledWith(userId, 450, expect.stringContaining('MV-00001'));
      expect(view.finalPayment.walletPaid).toBe(450);
      expect(view.finalPayment.cashPaid).toBe(1000);
      expect(view.finalPayment.settled).toBe(true);
      expect(view.remainingDue).toBe(0);
    });

    it('refuses to settle the same order twice', async () => {
      const order = await confirmedOrder();
      await service.payFinal(userId, order.id, 0);

      await expect(service.payFinal(userId, order.id, 0)).rejects.toThrow(BadRequestException);
      // The second attempt must not debit the wallet again.
      expect(walletMock.debit).not.toHaveBeenCalled();
    });

    it('refuses a wallet amount greater than the balance due', async () => {
      const order = await confirmedOrder();

      await expect(service.payFinal(userId, order.id, 99999)).rejects.toThrow(BadRequestException);
      expect(walletMock.debit).not.toHaveBeenCalled();
    });

    it('refuses settlement before the advance is paid', async () => {
      const order = await makePendingOrder('order_UNPAID');
      await expect(service.payFinal(userId, order.id, 0)).rejects.toThrow(BadRequestException);
    });

    it('refuses settlement on a cancelled order', async () => {
      const order = await confirmedOrder();
      order.status = OrderStatus.CANCELLED;
      await order.save();

      await expect(service.payFinal(userId, order.id, 0)).rejects.toThrow(BadRequestException);
      expect(walletMock.debit).not.toHaveBeenCalled();
    });

    it("refuses to settle another user's order", async () => {
      const order = await confirmedOrder();
      const someoneElse = new Types.ObjectId().toHexString();

      await expect(service.payFinal(someoneElse, order.id, 0)).rejects.toThrow();
      expect(walletMock.debit).not.toHaveBeenCalled();
    });
  });
});
