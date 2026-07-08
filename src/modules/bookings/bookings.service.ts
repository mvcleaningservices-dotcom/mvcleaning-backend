import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Booking, BookingDocument } from './schemas/booking.schema';
import { Counter, CounterDocument } from './schemas/counter.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ServicesService } from '../services/services.service';
import { SettingsService } from '../settings/settings.service';
import { RazorpayService } from '../payments/razorpay.service';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
    private readonly services: ServicesService,
    private readonly settings: SettingsService,
    private readonly razorpay: RazorpayService,
  ) {}

  /** Atomic, sequential, human-friendly order number (e.g. MV-00001). */
  private async nextOrderNumber(): Promise<string> {
    const counter = await this.counterModel.findOneAndUpdate(
      { name: 'order' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    return `MV-${String(counter.seq).padStart(5, '0')}`;
  }

  /**
   * Create a booking and start the advance payment (scope §3.1 steps 4–7).
   * - Prices are snapshotted from the current catalog.
   * - Advance amount is read from platform settings (may be 0 → auto-confirm).
   */
  async create(userId: string, dto: CreateBookingDto) {
    const services = await this.services.findActiveByIds(dto.serviceIds);
    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException(
        'One or more selected services are unavailable',
      );
    }

    const items = services.map((s) => ({
      service: s._id as Types.ObjectId,
      name: s.name,
      price: s.price,
    }));
    const totalAmount = items.reduce((sum, i) => sum + i.price, 0);
    const advanceAmount = await this.settings.getAdvanceAmount();

    const orderNumber = await this.nextOrderNumber();
    const booking = await this.bookingModel.create({
      orderNumber,
      user: new Types.ObjectId(userId),
      items,
      scheduledDate: dto.scheduledDate,
      timeSlot: dto.timeSlot,
      address: dto.address,
      totalAmount,
      advanceAmount,
      advancePaid: false,
      status: OrderStatus.PENDING,
    });

    // No advance configured → confirm immediately, no payment step.
    if (advanceAmount <= 0) {
      booking.advancePaid = true;
      booking.status = OrderStatus.CONFIRMED;
      await booking.save();
      return { booking: this.view(booking), payment: { required: false } };
    }

    // Live Razorpay → create an order the app can open in checkout.
    if (this.razorpay.isLive) {
      const order = await this.razorpay.createOrder(advanceAmount, orderNumber);
      booking.razorpayOrderId = order.id;
      await booking.save();
      return {
        booking: this.view(booking),
        payment: {
          required: true,
          provider: 'razorpay',
          razorpayOrderId: order.id,
          keyId: this.razorpay.keyId,
          amount: advanceAmount,
        },
      };
    }

    // Test mode (no keys) → confirm via the dev endpoint.
    return {
      booking: this.view(booking),
      payment: { required: true, provider: 'test', amount: advanceAmount },
    };
  }

  /**
   * Mark a booking's advance as paid and confirm it. Idempotent: a duplicate
   * or replayed webhook will not double-confirm or change anything twice.
   */
  async confirmAdvanceByRazorpayOrder(
    razorpayOrderId: string,
    paymentId: string,
  ): Promise<boolean> {
    const res = await this.bookingModel.updateOne(
      { razorpayOrderId, advancePaid: false },
      {
        $set: {
          advancePaid: true,
          status: OrderStatus.CONFIRMED,
          razorpayPaymentId: paymentId,
        },
      },
    );
    // modifiedCount 0 means already-confirmed (idempotent no-op) or unknown order.
    return res.modifiedCount > 0;
  }

  /** Test-mode confirmation by booking id (dev only). Idempotent. */
  async confirmAdvanceTest(bookingId: string, userId: string) {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException('Invalid booking id');
    }
    const booking = await this.bookingModel.findOne({
      _id: bookingId,
      user: new Types.ObjectId(userId),
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (!booking.advancePaid) {
      booking.advancePaid = true;
      booking.status = OrderStatus.CONFIRMED;
      booking.razorpayPaymentId = 'test_mode';
      await booking.save();
    }
    return this.view(booking);
  }

  /** A consumer's own bookings (basis for order history in Phase 5). */
  async listMine(userId: string) {
    const bookings = await this.bookingModel
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    return bookings.map((b) => this.view(b));
  }

  /** Shape a booking for API responses. */
  private view(b: BookingDocument) {
    return {
      id: b.id,
      orderNumber: b.orderNumber,
      items: b.items.map((i) => ({ name: i.name, price: i.price })),
      scheduledDate: b.scheduledDate,
      timeSlot: b.timeSlot,
      address: b.address,
      totalAmount: b.totalAmount,
      advanceAmount: b.advanceAmount,
      advancePaid: b.advancePaid,
      status: b.status,
    };
  }
}
