import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlatformSettingsDocument = HydratedDocument<PlatformSettings>;

/**
 * Single-document platform configuration (scope §3.2.5).
 * `advanceAmount` is the booking advance — fully Super-Admin-configurable and
 * may be 0 (advance optional). Editing UI is built in Phase 6; the value
 * exists from Phase 2 so bookings can read it.
 */
@Schema({ timestamps: true })
export class PlatformSettings {
  // Marks the single settings doc so we always upsert the same one.
  @Prop({ required: true, unique: true, default: 'platform' })
  key: string;

  @Prop({ required: true, min: 0, default: 49 })
  advanceAmount: number;
}

export const PlatformSettingsSchema =
  SchemaFactory.createForClass(PlatformSettings);
