import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wallet, WalletDocument } from './schemas/wallet.schema';
import {
  WalletTransaction,
  WalletTransactionDocument,
  WalletTxnStatus,
  WalletTxnType,
} from './schemas/wallet-transaction.schema';
import { RazorpayService } from '../payments/razorpay.service';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
    @InjectModel(WalletTransaction.name)
    private readonly txnModel: Model<WalletTransactionDocument>,
    private readonly razorpay: RazorpayService,
  ) {}

  private async getOrCreate(userId: string): Promise<WalletDocument> {
    return this.walletModel
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        { $setOnInsert: { user: new Types.ObjectId(userId), balance: 0 } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getOrCreate(userId);
    return wallet.balance;
  }

  async history(userId: string, limit = 50) {
    const txns = await this.txnModel
      .find({
        user: new Types.ObjectId(userId),
        status: WalletTxnStatus.COMPLETED,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return txns.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      description: t.description,
      at: (t as any).createdAt,
    }));
  }

  /** Start a top-up. Returns a payment intent (Razorpay live or test mode). */
  async createTopup(userId: string, amount: number) {
    if (!amount || amount < 1) {
      throw new BadRequestException('Enter a valid top-up amount');
    }
    await this.getOrCreate(userId);
    const txn = await this.txnModel.create({
      user: new Types.ObjectId(userId),
      type: WalletTxnType.TOPUP,
      status: WalletTxnStatus.PENDING,
      amount,
      description: 'Wallet top-up',
    });

    if (this.razorpay.isLive) {
      const order = await this.razorpay.createOrder(amount, `wallet_${txn.id}`);
      txn.razorpayOrderId = order.id;
      await txn.save();
      return {
        transactionId: txn.id,
        payment: {
          required: true,
          provider: 'razorpay',
          razorpayOrderId: order.id,
          keyId: this.razorpay.keyId,
          amount,
        },
      };
    }
    return {
      transactionId: txn.id,
      payment: { required: true, provider: 'test', amount },
    };
  }

  /** Idempotent top-up confirmation from the Razorpay webhook. */
  async confirmTopupByRazorpayOrder(
    razorpayOrderId: string,
  ): Promise<boolean> {
    const txn = await this.txnModel.findOneAndUpdate(
      {
        razorpayOrderId,
        type: WalletTxnType.TOPUP,
        status: WalletTxnStatus.PENDING,
      },
      { $set: { status: WalletTxnStatus.COMPLETED } },
      { new: true },
    );
    if (!txn) return false; // already completed or not a wallet top-up
    await this.applyCredit(txn);
    return true;
  }

  /**
   * Credit a top-up from a **verified** Razorpay checkout callback.
   *
   * The signature is checked by the caller before this runs, so reaching here
   * means Razorpay vouched for the payment. Scoped to the calling user's own
   * transaction and matched on `razorpayOrderId`, so a valid signature for one
   * order can never credit a different wallet.
   *
   * Idempotent: the PENDING filter means a retry (or a webhook landing
   * afterwards) credits nothing a second time.
   */
  async confirmTopupByCheckout(userId: string, razorpayOrderId: string) {
    const txn = await this.txnModel.findOneAndUpdate(
      {
        razorpayOrderId,
        user: new Types.ObjectId(userId),
        type: WalletTxnType.TOPUP,
        status: WalletTxnStatus.PENDING,
      },
      { $set: { status: WalletTxnStatus.COMPLETED } },
      { new: true },
    );
    // Already credited (or not this user's order) → report the balance as-is.
    if (txn) await this.applyCredit(txn);
    return { balance: await this.getBalance(userId) };
  }

  /** Test-mode top-up confirmation (dev only). Idempotent. */
  async confirmTopupTest(transactionId: string, userId: string) {
    if (!Types.ObjectId.isValid(transactionId)) {
      throw new BadRequestException('Invalid transaction id');
    }
    const txn = await this.txnModel.findOneAndUpdate(
      {
        _id: transactionId,
        user: new Types.ObjectId(userId),
        type: WalletTxnType.TOPUP,
        status: WalletTxnStatus.PENDING,
      },
      { $set: { status: WalletTxnStatus.COMPLETED } },
      { new: true },
    );
    if (!txn) {
      // Already confirmed (idempotent) — just return current balance.
      return { balance: await this.getBalance(userId) };
    }
    await this.applyCredit(txn);
    return { balance: await this.getBalance(userId) };
  }

  private async applyCredit(txn: WalletTransactionDocument) {
    const wallet = await this.walletModel.findOneAndUpdate(
      { user: txn.user },
      { $inc: { balance: txn.amount } },
      { new: true, upsert: true },
    );
    txn.balanceAfter = wallet!.balance;
    await txn.save();
  }

  /**
   * Atomically debit the wallet. The {balance: {$gte: amount}} filter makes
   * this safe under concurrency and guarantees the balance never goes negative.
   * Throws if funds are insufficient.
   */
  async debit(
    userId: string,
    amount: number,
    description: string,
  ): Promise<number> {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid debit amount');
    }
    const wallet = await this.walletModel.findOneAndUpdate(
      { user: new Types.ObjectId(userId), balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true },
    );
    if (!wallet) {
      throw new BadRequestException('Insufficient wallet balance');
    }
    await this.txnModel.create({
      user: new Types.ObjectId(userId),
      type: WalletTxnType.DEBIT,
      status: WalletTxnStatus.COMPLETED,
      amount,
      balanceAfter: wallet.balance,
      description,
    });
    return wallet.balance;
  }
}
