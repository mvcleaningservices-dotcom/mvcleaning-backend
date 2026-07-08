import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LeadDocument = HydratedDocument<Lead>;

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  CONVERTED = 'converted',
  NOT_INTERESTED = 'not_interested',
}

/**
 * A sales follow-up lead (scope §4.4.4): logged whenever a consumer
 * completes OTP login. If a booking follows, the lead is auto-marked
 * CONVERTED; otherwise the sales team works it manually via status updates.
 *
 * Note (documented limitation): the scope also calls for "time spent before
 * exit." A stateless JWT API has no logout/session-end signal to measure
 * that from, so this field is intentionally omitted rather than faked —
 * loginAt is recorded and the admin UI shows time-since-login instead.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Lead {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  mobile: string;

  @Prop({ required: true })
  loginAt: Date;

  @Prop({
    type: String,
    enum: Object.values(LeadStatus),
    default: LeadStatus.NEW,
    index: true,
  })
  status: LeadStatus;

  @Prop({ type: String, default: null })
  convertedOrderNumber?: string | null;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);
