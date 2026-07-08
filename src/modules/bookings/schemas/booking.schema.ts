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
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
