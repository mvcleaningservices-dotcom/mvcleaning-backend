import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WalletTransactionDocument = HydratedDocument<WalletTransaction>;

export enum WalletTxnType {
  TOPUP = 'topup',
  DEBIT = 'debit',
  REFUND = 'refund',
}

export enum WalletTxnStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

/**
 * Wallet ledger entry (scope §3.2.4 — transaction history). Top-ups start
 * PENDING and become COMPLETED only when payment is verified; debits are
 * created already COMPLETED. `balanceAfter` snapshots the balance post-entry.
 */
@Schema({ timestamps: true })
export class WalletTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(WalletTxnType), required: true })
  type: WalletTxnType;

  @Prop({
    type: String,
    enum: Object.values(WalletTxnStatus),
    default: WalletTxnStatus.COMPLETED,
    index: true,
  })
  status: WalletTxnStatus;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: Number, default: null })
  balanceAfter?: number | null;

  @Prop({ default: '' })
  description: string;

  // For top-ups paid via Razorpay (used for idempotent confirmation).
  @Prop({ type: String, default: null, index: true })
  razorpayOrderId?: string | null;
}

export const WalletTransactionSchema =
  SchemaFactory.createForClass(WalletTransaction);
