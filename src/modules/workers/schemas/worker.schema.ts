import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WorkerDocument = HydratedDocument<Worker>;

/**
 * An internal worker profile (scope §4.4.2). Workers have NO app access — these
 * are managed entirely by admins, who update order status on the worker's
 * behalf based on verbal feedback.
 */
@Schema({ timestamps: true })
export class Worker {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  contactNumber: string;

  @Prop({ default: '', trim: true })
  area: string;

  @Prop({ default: true })
  isActive: boolean;

  /**
   * List of service names this worker is qualified to perform.
   * Stored as plain strings (matching the ServiceItem.name field).
   * Existing workers without this field default to an empty array.
   */
  @Prop({ type: [String], default: [] })
  services: string[];
}

export const WorkerSchema = SchemaFactory.createForClass(Worker);
