import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ActivityLogDocument = HydratedDocument<ActivityLog>;

/**
 * A generic admin action audit entry (scope §4.3.1 — "View activity log of
 * Sub Admin actions"). Append-only. Logged from the mutation points that
 * matter for oversight: worker/service/sub-admin changes, order actions,
 * advance-amount config changes.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ActivityLog {
  @Prop({ required: true, index: true })
  adminUsername: string;

  @Prop({ required: true })
  role: string;

  @Prop({ required: true })
  action: string;

  @Prop({ default: '' })
  details: string;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
