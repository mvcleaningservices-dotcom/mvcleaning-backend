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

  /**
   * Optional login for a Service Partner (worker). Both are optional and only
   * set when an admin gives this worker portal access — existing workers with
   * neither behave exactly as before (no login). `sparse` lets many workers have
   * no username while keeping the ones that do unique.
   */
  @Prop({ trim: true, lowercase: true, index: { unique: true, sparse: true } })
  username?: string;

  @Prop()
  passwordHash?: string;
}

export const WorkerSchema = SchemaFactory.createForClass(Worker);
