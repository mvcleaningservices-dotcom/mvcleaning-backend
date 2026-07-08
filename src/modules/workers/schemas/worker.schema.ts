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
}

export const WorkerSchema = SchemaFactory.createForClass(Worker);
