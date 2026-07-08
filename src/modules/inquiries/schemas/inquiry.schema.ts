import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InquiryDocument = HydratedDocument<Inquiry>;

export enum InquiryType {
  CONTACT = 'contact',
  PARTNER = 'partner',
}

/**
 * A submission from the public Contact Us or Become a Partner form
 * (scope §5). No email provider is configured in this MVP, so submissions
 * are stored for the admin team to follow up on manually rather than
 * auto-emailed — avoids adding an unscoped external dependency.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Inquiry {
  @Prop({ type: String, enum: Object.values(InquiryType), required: true })
  type: InquiryType;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  email: string;

  @Prop({ default: '', trim: true })
  phone: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  resolved: boolean;
}

export const InquirySchema = SchemaFactory.createForClass(Inquiry);
