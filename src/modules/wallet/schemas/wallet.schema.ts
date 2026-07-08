import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WalletDocument = HydratedDocument<Wallet>;

/**
 * A consumer's wallet balance (scope §3.2.4). One per user. Balance is only
 * ever changed via atomic $inc operations (see WalletService) so it can never
 * go negative or be corrupted by concurrent requests.
 */
@Schema({ timestamps: true })
export class Wallet {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true, default: 0, min: 0 })
  balance: number;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
