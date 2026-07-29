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
    this.ensureAssignedWorkers(order);
    return order;
  }

  /**
   * Migrate legacy single worker to assignedWorkers array in memory if needed.
   */
  private ensureAssignedWorkers(order: BookingDocument) {
    if ((!order.assignedWorkers || order.assignedWorkers.length === 0) && order.assignedWorker && order.assignedWorkerName) {
      order.assignedWorkers = [
        {
          workerId: order.assignedWorker as any,
          workerName: order.assignedWorkerName,
          serviceName: '',
        },
      ];
    }
  }

  /**
   * Sync the legacy single-worker fields from the assignedWorkers array.
   * assignedWorker/assignedWorkerName always mirror the FIRST entry so that
   * existing status guards, filters and activity logs continue to work.
   */
  private syncLegacyFields(order: BookingDocument) {
    if (order.assignedWorkers && order.assignedWorkers.length > 0) {
      const first = order.assignedWorkers[0];
      order.assignedWorker = first.workerId as Types.ObjectId;
      order.assignedWorkerName = first.workerName;
    } else {
      order.assignedWorker = null;
      order.assignedWorkerName = null;
    }
  }

  /** Admin order list with optional filters (scope §4.4.1, §4.3.3). */
  async list(filters: {
    status?: string;
    workerId?: string;
    from?: string;
    to?: string;
    area?: string;
  }) {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.area) query.pincode = filters.area;
    if (filters.workerId && Types.ObjectId.isValid(filters.workerId)) {
      query.$or = [
        { assignedWorker: new Types.ObjectId(filters.workerId) },
        { 'assignedWorkers.workerId': new Types.ObjectId(filters.workerId) },
      ];
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

  /**
   * Assign a worker to a specific service slot (Admin Fix #007).
   *
   * Rules:
   * - Order must be CONFIRMED or already ASSIGNED/IN_PROGRESS (multi-worker
   *   allows adding more workers to an already-active order).
   * - The same worker can only appear once in the array (duplicate guard).
   * - A serviceName slot can be replaced — it removes the previous entry for
   *   that service before adding the new one.
   * - The order status moves to ASSIGNED the first time any worker is added.
   */
  async assign(
    id: string,
    workerId: string,
    serviceName: string,
    adminUsername: string,
  ) {
    const order = await this.load(id);

    if (!ACTIVE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Order must be confirmed or active to assign workers',
      );
    }

    const worker = await this.workers.getAssignable(workerId);
    const workerObjId = worker._id as Types.ObjectId;

    // If this service slot already has a worker, remove it first (replace).
    if (serviceName) {
      order.assignedWorkers = (order.assignedWorkers ?? []).filter(
        (e: any) => e.serviceName !== serviceName,
      ) as any;
    }

    // A worker CAN cover several services in one order (e.g. Plumbing +
    // Electrical), so we don't block a worker who's already on the order. We
    // only block assigning the same worker to the SAME service twice — and even
    // that can't normally happen because the replace-per-slot above already
    // cleared this service. This guards the extra unnamed slots.
    const duplicate = (order.assignedWorkers ?? []).some(
      (e: any) =>
        String(e.workerId) === String(workerObjId) &&
        (e.serviceName ?? '') === (serviceName ?? ''),
    );
    if (duplicate) {
      throw new BadRequestException(
        `${worker.name} is already assigned to ${serviceName || 'this order'}`,
      );
    }

    (order.assignedWorkers as any[]).push({
      workerId: workerObjId,
      workerName: worker.name,
      serviceName: serviceName ?? '',
    });

    this.syncLegacyFields(order);

    // Move to ASSIGNED on first assignment.
    if (order.status === OrderStatus.CONFIRMED) {
      order.status = OrderStatus.ASSIGNED;
    }

    await order.save();
    return this.full(order);
  }

  /**
   * Remove a worker from a specific slot (Admin Fix #007).
   * If the removed worker was the primary (first), the next entry becomes primary.
   * If the array becomes empty, status stays as-is (admin must cancel manually).
   */
  async removeAssignment(id: string, workerId: string) {
    const order = await this.load(id);

    if (!ACTIVE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Cannot modify assignments on a completed or cancelled order',
      );
    }

    const before = (order.assignedWorkers ?? []).length;
    order.assignedWorkers = (order.assignedWorkers ?? []).filter(
      (e: any) => String(e.workerId) !== workerId,
    ) as any;

    if ((order.assignedWorkers ?? []).length === before) {
      throw new NotFoundException('Worker not found in this order');
    }

    this.syncLegacyFields(order);
    await order.save();
    return this.full(order);
  }

  /** Emergency reassignment — replaces ONE specific worker slot. */
  async reassign(
    id: string,
    oldWorkerId: string,
    newWorkerId: string,
    reason: string,
    adminUsername: string,
  ) {
    const order = await this.load(id);

    if (!ACTIVE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Only active orders can be reassigned',
      );
    }
    if (!reason?.trim()) {
      throw new BadRequestException('A reassignment reason is required');
    }

    const newWorker = await this.workers.getAssignable(newWorkerId);
    const newWorkerObjId = newWorker._id as Types.ObjectId;

    // Find the slot being replaced.
    const slotIndex = (order.assignedWorkers ?? []).findIndex(
      (e: any) => String(e.workerId) === oldWorkerId,
    );

    let fromWorkerName: string | null = null;
    if (slotIndex >= 0) {
      fromWorkerName = (order.assignedWorkers as any[])[slotIndex].workerName;
      const serviceName = (order.assignedWorkers as any[])[slotIndex].serviceName;
      (order.assignedWorkers as any[])[slotIndex] = {
        workerId: newWorkerObjId,
        workerName: newWorker.name,
        serviceName,
      };
    } else {
      // Fallback: legacy reassign (no slot found — just push new worker).
      fromWorkerName = order.assignedWorkerName ?? null;
      (order.assignedWorkers as any[]).push({
        workerId: newWorkerObjId,
        workerName: newWorker.name,
        serviceName: '',
      });
    }

    order.reassignments.push({
      fromWorkerName,
      toWorkerName: newWorker.name,
      reason: reason.trim(),
      adminUsername,
    } as any);

    this.syncLegacyFields(order);

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
      throw new BadRequestException('Assign at least one worker before progressing');
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
        $or: [{ assignedWorker: wid }, { 'assignedWorkers.workerId': wid }],
        status: { $in: ACTIVE_STATUSES },
      }),
      this.bookingModel
        .find({ $or: [{ assignedWorker: wid }, { 'assignedWorkers.workerId': wid }] })
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

  /** Remaining balance due after advance and any final payment made so far. */
  private remainingDue(o: BookingDocument): number {
    const advance = o.advancePaid ? o.advanceAmount : 0;
    const paidSoFar = o.finalWalletPaid + o.finalCashPaid + o.finalOnlinePaid;
    return Math.max(0, o.totalAmount - advance - paidSoFar);
  }

  // ---- shaping ----
  private summary(o: BookingDocument) {
    this.ensureAssignedWorkers(o);
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
      // Legacy field — still the "primary" worker name for the table column.
      assignedWorkerName: o.assignedWorkerName ?? null,
      // Full array so the orders table tooltip / list can show all workers.
      assignedWorkers: (o.assignedWorkers ?? []).map((e: any) => ({
        workerId: String(e.workerId),
        workerName: e.workerName,
        serviceName: e.serviceName ?? '',
      })),
      remainingDue: this.remainingDue(o),
      finalPayment: {
        walletPaid: o.finalWalletPaid,
        cashPaid: o.finalCashPaid,
        settled: o.finalSettled,
      },
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
      proofImages: o.proofImages,
      cancelReason: o.cancelReason ?? null,
      completedAt: o.completedAt ?? null,
    };
  }
}
