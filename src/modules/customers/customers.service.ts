import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { Wallet, WalletDocument } from '../wallet/schemas/wallet.schema';
import {
  WalletTransaction,
  WalletTransactionDocument,
  WalletTxnStatus,
} from '../wallet/schemas/wallet-transaction.schema';

/**
 * Customer Database + Consumer Overview (scope §4.4.3, §4.4.5).
 * Read-only aggregation across Users/Bookings/Wallet — injects the models
 * directly rather than depending on the other modules' services, since this
 * is purely a read/reporting concern (avoids coupling those modules to an
 * admin-facing feature).
 */
@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Wallet.name) private readonly walletModel: Model<WalletDocument>,
    @InjectModel(WalletTransaction.name)
    private readonly walletTxnModel: Model<WalletTransactionDocument>,
  ) {}

  private escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Customer Database list: username, phone, order count, last login. */
  async list(search?: string) {
    const filter: Record<string, unknown> = {};
    if (search?.trim()) {
      const rx = { $regex: this.escapeRegex(search.trim()), $options: 'i' };
      filter.$or = [{ mobile: rx }, { name: rx }];
    }
    const users = await this.userModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();

    const userIds = users.map((u) => u._id);
    const counts = await this.bookingModel.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>(
      counts.map((c) => [String(c._id), c.count]),
    );

    return users.map((u) => ({
      id: u.id,
      username: u.name ?? u.mobile,
      phone: u.mobile,
      noOfOrders: countMap.get(String(u._id)) ?? 0,
      lastLogin: u.lastLoginAt ?? null,
    }));
  }

  /** Consumer Overview: full order + wallet history for one customer. */
  async detail(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Customer not found');
    }
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Customer not found');

    const [orders, wallet, walletHistory] = await Promise.all([
      this.bookingModel.find({ user: user._id }).sort({ createdAt: -1 }).limit(100).exec(),
      this.walletModel.findOne({ user: user._id }).exec(),
      this.walletTxnModel
        .find({ user: user._id, status: WalletTxnStatus.COMPLETED })
        .sort({ createdAt: -1 })
        .limit(50)
        .exec(),
    ]);

    return {
      profile: {
        id: user.id,
        mobile: user.mobile,
        name: user.name ?? null,
        address: user.address ?? '',
        pincode: user.pincode ?? '',
        lastLogin: user.lastLoginAt ?? null,
      },
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        services: o.items.map((i) => i.name),
        totalAmount: o.totalAmount,
        status: o.status,
        scheduledDate: o.scheduledDate,
      })),
      wallet: {
        balance: wallet?.balance ?? 0,
        history: walletHistory.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          at: (t as any).createdAt,
        })),
      },
    };
  }
}
