import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ServiceDocument = HydratedDocument<Service>;

/**
 * A bookable service (scope §3.2.2, §4.3.2).
 * `pincodes` controls where it's visible; `isActive` toggles availability.
 * Full admin CRUD is Phase 6 — Phase 2 needs read + a dev seed.
 */
@Schema({ timestamps: true })
export class Service {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, min: 0 })
  price: number;

  // Pincodes where this service is offered.
  @Prop({ type: [String], default: [], index: true })
  pincodes: string[];

  // Optional marketing image (admin-set URL) shown on the consumer home grid.
  @Prop({ default: '' })
  imageUrl: string;

  // Optional grouping used for the consumer category filter (e.g. "Cleaning",
  // "Repair"). Free-form so admins can define their own taxonomy.
  @Prop({ default: '', index: true })
  category: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

// The consumer catalog is the hottest read path in the app: every homepage load
// runs find({ isActive, pincodes }). This compound index serves that query, and
// its `isActive` prefix also serves the marketing listing's find({ isActive }).
ServiceSchema.index({ isActive: 1, pincodes: 1 });
