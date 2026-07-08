import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrderStatus } from '../../../common/enums/order-status.enum';

export type BookingDocument = HydratedDocument<Booking>;

/** A single service line captured at booking time (price snapshotted). */
@Schema({ _id: false })
export class BookingItem {
  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  service: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;
}
const BookingItemSchema = SchemaFactory.createForClass(BookingItem);

/** An internal admin note on an order (scope §4.4.1). */
@Schema({ _id: false, timestamps: { createdAt: 'at', updatedAt: false } })
export class OrderNote {
  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  adminUsername: string;
}
const OrderNoteSchema = SchemaFactory.createForClass(OrderNote);

/**
 * One entry in the worker reassignment audit log (scope §4.4.1a).
 * Append-only — a full trail of who changed the worker, when, and why.
 */
@Schema({ _id: false, timestamps: { createdAt: 'at', updatedAt: false } })
export class Reassignment {
  @Prop({ type: String, default: null })
  fromWorkerName: string | null;

  @Prop({ required: true })
  toWorkerName: string;

  @Prop({ required: true })
  reason: string;

  @Prop({ required: true })
  adminUsername: string;
}
const ReassignmentSchema = SchemaFactory.createForClass(Reassignment);

/**
 * A consumer booking / order (scope §3.1, §3.2.3, §3.2.6).
 * Created as PENDING; becomes CONFIRMED once the advance is paid (or when the
 * configured advance is 0). Payment provider details support idempotent
 * confirmation from the Razorpay webhook.
 */
@Schema({ timestamps: true })
export class Booking {
  @Prop({ required: true, unique: true, index: true })
  orderNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: [BookingItemSchema], required: true })
  items: BookingItem[];

  @Prop({ required: true })
  scheduledDate: string; // ISO date (YYYY-MM-DD)

  @Prop({ required: true })
  timeSlot: string; // e.g. "10:00-12:00"

  @Prop({ required: true })
  address: string;

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ required: true, min: 0 })
  advanceAmount: number;

  @Prop({ default: false })
  advancePaid: boolean;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING,
    index: true,
  })
  status: OrderStatus;

  // Payment provider references (for idempotent confirmation).
  @Prop({ default: null })
  razorpayOrderId?: string;

  @Prop({ default: null })
  razorpayPaymentId?: string;

  // ---- Admin order management (Phase 3) ----

  @Prop({ type: Types.ObjectId, ref: 'Worker', default: null, index: true })
  assignedWorker?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  assignedWorkerName?: string | null;

  @Prop({ type: [OrderNoteSchema], default: [] })
  notes: OrderNote[];

  @Prop({ type: [ReassignmentSchema], default: [] })
  reassignments: Reassignment[];

  // Optional proof-of-work images (scope §4.4.1 — not mandatory, non-blocking).
  @Prop({ type: [String], default: [] })
  proofImages: string[];

  @Prop({ type: String, default: null })
  cancelReason?: string | null;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;

  // ---- Final payment (Phase 4, scope §3.2.4) ----
  // The balance after advance, settled via wallet + cash (+ online).
  @Prop({ default: 0, min: 0 })
  finalWalletPaid: number;

  @Prop({ default: 0, min: 0 })
  finalCashPaid: number;

  @Prop({ default: 0, min: 0 })
  finalOnlinePaid: number;

  @Prop({ default: false })
  finalSettled: boolean;

  @Prop({ type: Date, default: null })
  finalSettledAt?: Date | null;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
