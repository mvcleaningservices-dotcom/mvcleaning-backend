import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { WorkersService } from '../workers/workers.service';
import { OrderStatus } from '../../common/enums/order-status.enum';

const ACTIVE = [
  OrderStatus.CONFIRMED,
  OrderStatus.ASSIGNED,
  OrderStatus.IN_PROGRESS,
];

/**
 * Read-only data for the Service Partner portal. Every query is scoped by the
 * partner's OWN worker id (taken from their token, never a request parameter),
 * so a partner can only ever see their own orders and earnings.
 */
@Injectable()
export class PartnerService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly workers: WorkersService,
  ) {}

  async me(workerId: string) {
    const w = await this.workers.findById(workerId);
    return {
      id: w.id,
      name: w.name,
      username: w.username ?? '',
      area: w.area,
      services: w.services ?? [],
    };
  }

  /** Shape one booking down to only what this partner should see. */
  private shape(b: BookingDocument, workerId: string) {
    const mine = (b.assignedWorkers ?? []).filter(
      (e: any) => String(e.workerId) === workerId,
    );
    const myServices = mine.map((e: any) => e.serviceName).filter(Boolean);
    // Value of the specific services THIS partner handled on the order.
    const value = (b.items ?? [])
      .filter((i) => myServices.includes(i.name))
      .reduce((sum, i) => sum + i.price, 0);
    return {
      orderNumber: b.orderNumber,
      services: myServices.length ? myServices : b.items.map((i) => i.name),
      scheduledDate: b.scheduledDate,
      timeSlot: b.timeSlot,
      address: b.address,
      status: b.status,
      value,
      createdAt: (b as any).createdAt,
    };
  }

  async orders(workerId: string) {
    const wid = new Types.ObjectId(workerId);
    const bookings = await this.bookingModel
      .find({ 'assignedWorkers.workerId': wid })
      .sort({ createdAt: -1 })
      .exec();
    return bookings.map((b) => this.shape(b, workerId));
  }

  /** Simple analytics — order counts and the value of services handled. */
  async earnings(workerId: string) {
    const wid = new Types.ObjectId(workerId);
    const bookings = await this.bookingModel
      .find({ 'assignedWorkers.workerId': wid })
      .exec();

    const now = new Date();
    let active = 0;
    let completed = 0;
    let totalValue = 0;
    let monthValue = 0;

    for (const b of bookings) {
      const { value } = this.shape(b, workerId);
      if (b.status === OrderStatus.COMPLETED) {
        completed += 1;
        totalValue += value;
        const created = (b as any).createdAt as Date | undefined;
        if (
          created &&
          new Date(created).getMonth() === now.getMonth() &&
          new Date(created).getFullYear() === now.getFullYear()
        ) {
          monthValue += value;
        }
      } else if (ACTIVE.includes(b.status)) {
        active += 1;
      }
    }

    return {
      totalOrders: bookings.length,
      activeOrders: active,
      completedOrders: completed,
      totalValue,
      thisMonthValue: monthValue,
    };
  }
}
