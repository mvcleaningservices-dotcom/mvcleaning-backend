import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

/**
 * Consumer account (scope §3.2.1, §3.2.7).
 * Created on first successful OTP verification. Mobile number is the identity.
 * Profile fields (name, address, pincode) are filled/expanded in later phases.
 */
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  mobile: string;

  @Prop()
  name?: string;

  @Prop({ default: null })
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
