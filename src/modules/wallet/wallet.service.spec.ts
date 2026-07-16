import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

import { WalletService } from './wallet.service';
import { Wallet, WalletSchema, WalletDocument } from './schemas/wallet.schema';
import {
  WalletTransaction,
  WalletTransactionSchema,
  WalletTransactionDocument,
  WalletTxnStatus,
  WalletTxnType,
} from './schemas/wallet-transaction.schema';
import { RazorpayService } from '../payments/razorpay.service';

/**
 * Money-safety tests for the wallet — run against a REAL (in-memory) MongoDB,
 * not mocks, because the guarantees under test are enforced by Mongo's atomic
 * operators. Mocking the model would prove nothing.
 *
 * These cover the ways a wallet can lose or invent money:
 *   1. Overdraft (spending money you don't have)
 *   2. Concurrent debits racing past the balance check
 *   3. A replayed Razorpay webhook double-crediting a top-up
 */
describe('WalletService (money safety)', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: WalletService;
  let walletModel: Model<WalletDocument>;
  let txnModel: Model<WalletTransactionDocument>;

  const userId = new Types.ObjectId().toHexString();

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Wallet.name, schema: WalletSchema },
          { name: WalletTransaction.name, schema: WalletTransactionSchema },
        ]),
      ],
      providers: [
        WalletService,
        // Razorpay stays in test mode — these tests never hit the network.
        { provide: RazorpayService, useValue: { isLive: false, keyId: '' } },
      ],
    }).compile();

    service = moduleRef.get(WalletService);
    walletModel = moduleRef.get(getModelToken(Wallet.name));
    txnModel = moduleRef.get(getModelToken(WalletTransaction.name));
  }, 60000);

  afterAll(async () => {
    // Close the Mongoose connection before stopping Mongo, or Jest hangs on an
    // open handle (which would stall CI rather than fail it).
    await moduleRef.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await walletModel.deleteMany({});
    await txnModel.deleteMany({});
  });

  /** Put a known balance on the wallet without going through a payment flow. */
  const seedBalance = async (amount: number) => {
    await walletModel.findOneAndUpdate(
      { user: new Types.ObjectId(userId) },
      { $set: { balance: amount } },
      { upsert: true, new: true },
    );
  };

  describe('debit', () => {
    it('refuses to overdraw and leaves the balance untouched', async () => {
      await seedBalance(100);

      await expect(service.debit(userId, 150, 'too much')).rejects.toThrow(
        BadRequestException,
      );

      expect(await service.getBalance(userId)).toBe(100);
      // A failed debit must not leave a transaction record behind.
      expect(await txnModel.countDocuments({})).toBe(0);
    });

    it('debits exactly once and records the resulting balance', async () => {
      await seedBalance(500);

      const balance = await service.debit(userId, 200, 'Advance for MV-00001');

      expect(balance).toBe(300);
      expect(await service.getBalance(userId)).toBe(300);

      const txns = await txnModel.find({});
      expect(txns).toHaveLength(1);
      expect(txns[0].type).toBe(WalletTxnType.DEBIT);
      expect(txns[0].amount).toBe(200);
      expect(txns[0].balanceAfter).toBe(300);
    });

    it('CONCURRENCY: parallel debits can never push the balance negative', async () => {
      // 100 available, ten simultaneous ₹20 debits. Only five can succeed.
      await seedBalance(100);

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => service.debit(userId, 20, 'race')),
      );

      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      expect(ok).toBe(5);
      expect(failed).toBe(5);

      // The invariant that actually matters: money is never invented.
      const balance = await service.getBalance(userId);
      expect(balance).toBe(0);
      expect(balance).toBeGreaterThanOrEqual(0);
      expect(await txnModel.countDocuments({})).toBe(5);
    });

    it('rejects zero and negative amounts', async () => {
      await seedBalance(100);
      await expect(service.debit(userId, 0, 'zero')).rejects.toThrow(BadRequestException);
      await expect(service.debit(userId, -50, 'negative')).rejects.toThrow(BadRequestException);
      expect(await service.getBalance(userId)).toBe(100);
    });
  });

  describe('confirmTopupByRazorpayOrder (webhook replay)', () => {
    const makePendingTopup = async (amount: number, razorpayOrderId: string) =>
      txnModel.create({
        user: new Types.ObjectId(userId),
        type: WalletTxnType.TOPUP,
        status: WalletTxnStatus.PENDING,
        amount,
        description: 'Wallet top-up',
        razorpayOrderId,
      });

    it('credits the wallet once on the first webhook', async () => {
      await makePendingTopup(500, 'order_ABC');

      const applied = await service.confirmTopupByRazorpayOrder('order_ABC');

      expect(applied).toBe(true);
      expect(await service.getBalance(userId)).toBe(500);
    });

    it('IDEMPOTENT: a replayed webhook does NOT double-credit', async () => {
      await makePendingTopup(500, 'order_ABC');

      const first = await service.confirmTopupByRazorpayOrder('order_ABC');
      const second = await service.confirmTopupByRazorpayOrder('order_ABC');
      const third = await service.confirmTopupByRazorpayOrder('order_ABC');

      expect(first).toBe(true);
      expect(second).toBe(false); // already completed — no-op
      expect(third).toBe(false);

      // The money test: still 500, not 1500.
      expect(await service.getBalance(userId)).toBe(500);
    });

    it('IDEMPOTENT under concurrency: simultaneous webhooks credit only once', async () => {
      // Razorpay can deliver the same event more than once, in parallel.
      await makePendingTopup(500, 'order_RACE');

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          service.confirmTopupByRazorpayOrder('order_RACE'),
        ),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await service.getBalance(userId)).toBe(500);
    });

    it('ignores an unknown Razorpay order id', async () => {
      const applied = await service.confirmTopupByRazorpayOrder('order_UNKNOWN');
      expect(applied).toBe(false);
      expect(await service.getBalance(userId)).toBe(0);
    });
  });
});
