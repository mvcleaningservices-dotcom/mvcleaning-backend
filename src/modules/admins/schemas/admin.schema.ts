import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../../../common/enums/role.enum';

export type AdminDocument = HydratedDocument<Admin>;

/**
 * Admin account — Super Admin or Sub Admin (scope §4.1, §4.2).
 * Password login only (no OTP). Password stored hashed (bcrypt), never plaintext.
 */
@Schema({ timestamps: true })
export class Admin {
  @Prop({ required: true, unique: true, index: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({
    required: true,
    enum: [Role.SUPER_ADMIN, Role.SUB_ADMIN],
    type: String,
  })
  role: Role.SUPER_ADMIN | Role.SUB_ADMIN;

  @Prop({ default: true })
  isActive: boolean;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
