import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import {
  WalletTransaction,
  WalletTransactionDocument,
  WalletTxnStatus,
  WalletTxnType,
} from '../wallet/schemas/wallet-transaction.schema';
import { Worker, WorkerDocument } from '../workers/schemas/worker.schema';
import { OrderStatus } from '../../common/enums/order-status.enum';

const ACTIVE_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.ASSIGNED,
  OrderStatus.IN_PROGRESS,
];

/**
 * Platform reporting — Super Admin exclusive (scope §4.3.3).
 * Revenue overview, wallet transaction summary, worker performance.
 */
@Injectable()
export class ReportingService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(WalletTransaction.name)
    private readonly walletTxnModel: Model<WalletTransactionDocument>,
    @InjectModel(Worker.name)
    private readonly workerModel: Model<WorkerDocument>,
  ) {}

  private dateRange(from?: string, to?: string) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(`${to}T23:59:59.999Z`);
    return Object.keys(range).length ? range : undefined;
  }

  /** Revenue overview: order volume + how the money actually came in. */
  async revenue(from?: string, to?: string) {
    const range = this.dateRange(from, to);
    const match: Record<string, unknown> = { status: { $ne: OrderStatus.CANCELLED } };
    if (range) match.createdAt = range;

    const orders = await this.bookingModel.find(match).exec();

    let totalRevenue = 0;
    let advanceCollected = 0;
    let walletCollected = 0;
    let cashCollected = 0;
    let onlineCollected = 0;

    for (const o of orders) {
      totalRevenue += o.totalAmount;
      if (o.advancePaid) advanceCollected += o.advanceAmount;
      walletCollected += o.finalWalletPaid;
      cashCollected += o.finalCashPaid;
      onlineCollected += o.finalOnlinePaid;
    }

    return {
      totalOrders: orders.length,
      totalRevenue,
      advanceCollected,
      walletCollected,
      cashCollected,
      onlineCollected,
    };
  }

  /** Wallet transaction summary — total top-ups vs. debits platform-wide. */
  async walletSummary() {
    const rows = await this.walletTxnModel.aggregate([
      { $match: { status: WalletTxnStatus.COMPLETED } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const byType = Object.fromEntries(rows.map((r) => [r._id, r]));
    return {
      totalTopups: byType[WalletTxnType.TOPUP]?.total ?? 0,
      topupCount: byType[WalletTxnType.TOPUP]?.count ?? 0,
      totalDebits: byType[WalletTxnType.DEBIT]?.total ?? 0,
      debitCount: byType[WalletTxnType.DEBIT]?.count ?? 0,
    };
  }

  /** Worker performance: orders handled per worker (scope §4.3.3). */
  async workerPerformance() {
    const workers = await this.workerModel.find().sort({ name: 1 }).exec();
    const results = await Promise.all(
      workers.map(async (w) => {
        const [completedCount, activeCount, totalAssigned] = await Promise.all([
          this.bookingModel.countDocuments({
            assignedWorker: w._id,
            status: OrderStatus.COMPLETED,
          }),
          this.bookingModel.countDocuments({
            assignedWorker: w._id,
            status: { $in: ACTIVE_STATUSES },
          }),
          this.bookingModel.countDocuments({ assignedWorker: w._id }),
        ]);
        return {
          workerId: w.id,
          name: w.name,
          isActive: w.isActive,
          completedCount,
          activeCount,
          totalAssigned,
        };
      }),
    );
    return results.sort((a, b) => b.completedCount - a.completedCount);
  }
}
