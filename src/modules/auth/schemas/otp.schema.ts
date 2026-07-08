import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OtpDocument = HydratedDocument<Otp>;

/**
 * A pending OTP challenge for a mobile number (scope §3.2.1).
 * The code is stored HASHED, never plaintext. Expired docs auto-delete via TTL.
 * `attempts` caps verification tries to prevent brute-forcing the code.
 */
@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true, index: true })
  mobile: string;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  attempts: number;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// Auto-remove OTP documents once expiresAt passes.
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
