import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { WorkersService } from '../workers/workers.service';
import { OrderStatus } from '../../common/enums/order-status.enum';

// Allowed status transitions (scope §4.4.1). Terminal states have none.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.ASSIGNED]: [
    OrderStatus.IN_PROGRESS,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

const ACTIVE_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.ASSIGNED,
  OrderStatus.IN_PROGRESS,
];

// Proof image guards (base64 data URLs stored inline for MVP).
const MAX_PROOF_IMAGES = 5;
const MAX_PROOF_CHARS = 2_800_000; // ~2 MB binary

@Injectable()
export class AdminOrdersService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly workers: WorkersService,
  ) {}

  private assertTransition(from: OrderStatus, to: OrderStatus) {
    if (!TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(`Cannot move order from ${from} to ${to}`);
    }
  }

  private async load(id: string): Promise<BookingDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order id');
    }
    const order = await this.bookingModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Admin order list with optional filters (scope §4.4.1, §4.3.3). */
  async list(filters: {
    status?: string;
    workerId?: string;
    from?: string;
    to?: string;
  }) {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.workerId && Types.ObjectId.isValid(filters.workerId)) {
      query.assignedWorker = new Types.ObjectId(filters.workerId);
    }
    if (filters.from || filters.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) createdAt.$gte = new Date(filters.from);
      if (filters.to) createdAt.$lte = new Date(`${filters.to}T23:59:59.999Z`);
      query.createdAt = createdAt;
    }

    const orders = await this.bookingModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'mobile name')
      .exec();
    return orders.map((o) => this.summary(o));
  }

  async detail(id: string) {
    const order = await this.bookingModel
      .findById(id)
      .populate('user', 'mobile name')
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    return this.full(order);
  }

  /** First-time worker assignment. Order must be CONFIRMED and unassigned. */
  async assign(id: string, workerId: string, adminUsername: string) {
    const order = await this.load(id);
    if (order.assignedWorker) {
      throw new BadRequestException(
        'Order already has a worker — use reassign instead',
      );
    }
    this.assertTransition(order.status, OrderStatus.ASSIGNED);
    const worker = await this.workers.getAssignable(workerId);

    order.assignedWorker = worker._id as Types.ObjectId;
    order.assignedWorkerName = worker.name;
    order.status = OrderStatus.ASSIGNED;
    await order.save();
    return this.full(order);
  }

  /** Emergency reassignment with a logged audit trail (scope §4.4.1a). */
  async reassign(
    id: string,
    workerId: string,
    reason: string,
    adminUsername: string,
  ) {
    const order = await this.load(id);
    if (!ACTIVE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Only active (non-completed/cancelled) orders can be reassigned',
      );
    }
    if (!reason?.trim()) {
      throw new BadRequestException('A reassignment reason is required');
    }
    const worker = await this.workers.getAssignable(workerId);

    order.reassignments.push({
      fromWorkerName: order.assignedWorkerName ?? null,
      toWorkerName: worker.name,
      reason: reason.trim(),
      adminUsername,
    } as any);
    order.assignedWorker = worker._id as Types.ObjectId;
    order.assignedWorkerName = worker.name;
    if (order.status === OrderStatus.CONFIRMED) {
      order.status = OrderStatus.ASSIGNED;
    }
    await order.save();
    return this.full(order);
  }

  async updateStatus(id: string, next: OrderStatus, _adminUsername: string) {
    const order = await this.load(id);
    this.assertTransition(order.status, next);
    if (
      (next === OrderStatus.IN_PROGRESS || next === OrderStatus.COMPLETED) &&
      !order.assignedWorker
    ) {
      throw new BadRequestException('Assign a worker before progressing');
    }
    order.status = next;
    if (next === OrderStatus.COMPLETED) order.completedAt = new Date();
    await order.save();
    return this.full(order);
  }

  async complete(id: string, adminUsername: string) {
    return this.updateStatus(id, OrderStatus.COMPLETED, adminUsername);
  }

  async cancel(id: string, reason: string, _adminUsername: string) {
    const order = await this.load(id);
    this.assertTransition(order.status, OrderStatus.CANCELLED);
    order.status = OrderStatus.CANCELLED;
    order.cancelReason = reason?.trim() || null;
    await order.save();
    return this.full(order);
  }

  async addNote(id: string, text: string, adminUsername: string) {
    if (!text?.trim()) throw new BadRequestException('Note text is required');
    const order = await this.load(id);
    order.notes.push({ text: text.trim(), adminUsername } as any);
    await order.save();
    return this.full(order);
  }

  /** Attach an optional proof image (non-blocking, size/count capped). */
  async addProof(id: string, imageData: string) {
    if (!imageData || typeof imageData !== 'string') {
      throw new BadRequestException('Image data is required');
    }
    if (imageData.length > MAX_PROOF_CHARS) {
      throw new BadRequestException('Image too large (max ~2 MB)');
    }
    const order = await this.load(id);
    if (order.proofImages.length >= MAX_PROOF_IMAGES) {
      throw new BadRequestException(`Max ${MAX_PROOF_IMAGES} images per order`);
    }
    order.proofImages.push(imageData);
    await order.save();
    return { count: order.proofImages.length };
  }

  /** Worker workload (active assigned) + assignment history (scope §4.4.2). */
  async workerSummary(workerId: string) {
    const worker = await this.workers.findById(workerId);
    const wid = worker._id as Types.ObjectId;
    const [activeCount, orders] = await Promise.all([
      this.bookingModel.countDocuments({
        assignedWorker: wid,
        status: { $in: ACTIVE_STATUSES },
      }),
      this.bookingModel
        .find({ assignedWorker: wid })
        .sort({ createdAt: -1 })
        .limit(50)
        .exec(),
    ]);
    return {
      worker: this.workers.view(worker),
      currentWorkload: activeCount,
      history: orders.map((o) => this.summary(o)),
    };
  }

  // ---- shaping ----
  private summary(o: BookingDocument) {
    const user = o.user as any;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      consumer:
        user && user.mobile
          ? { mobile: user.mobile, name: user.name ?? null }
          : null,
      services: o.items.map((i) => i.name),
      scheduledDate: o.scheduledDate,
      timeSlot: o.timeSlot,
      totalAmount: o.totalAmount,
      advanceAmount: o.advanceAmount,
      advancePaid: o.advancePaid,
      status: o.status,
      assignedWorkerName: o.assignedWorkerName ?? null,
    };
  }

  private full(o: BookingDocument) {
    const user = o.user as any;
    return {
      ...this.summary(o),
      address: o.address,
      items: o.items.map((i) => ({ name: i.name, price: i.price })),
      notes: o.notes.map((n: any) => ({
        text: n.text,
        adminUsername: n.adminUsername,
        at: n.at,
      })),
      reassignments: o.reassignments.map((r: any) => ({
        fromWorkerName: r.fromWorkerName,
        toWorkerName: r.toWorkerName,
        reason: r.reason,
        adminUsername: r.adminUsername,
        at: r.at,
      })),
      proofImageCount: o.proofImages.length,
      cancelReason: o.cancelReason ?? null,
      completedAt: o.completedAt ?? null,
    };
  }
}
