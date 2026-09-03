import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import axios from 'axios';

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
}

/**
 * Razorpay integration for advance/wallet/online payments (scope §2.1, §3.2.5).
 *
 * LIVE when RAZORPAY_KEY_ID + KEY_SECRET are set. Otherwise runs in TEST MODE:
 * no real order is created, and payment is confirmed via a dev-only endpoint.
 * This keeps the booking + payment flow fully testable offline; it flips to
 * real Razorpay the moment credentials are added to .env.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);

  constructor(private readonly config: ConfigService) {}

  get isLive(): boolean {
    return (
      !!this.config.get<string>('razorpay.keyId') &&
      !!this.config.get<string>('razorpay.keySecret')
    );
  }

  get keyId(): string {
    return this.config.get<string>('razorpay.keyId') || '';
  }

  /** Create a Razorpay order for the given rupee amount. */
  async createOrder(
    amountRupees: number,
    receipt: string,
  ): Promise<RazorpayOrder> {
    const amountPaise = Math.round(amountRupees * 100);
    const res = await axios.post(
      'https://api.razorpay.com/v1/orders',
      { amount: amountPaise, currency: 'INR', receipt },
      {
        auth: {
          username: this.keyId,
          password: this.config.get<string>('razorpay.keySecret') || '',
        },
      },
    );
    return res.data as RazorpayOrder;
  }

  /**
   * Verify a checkout callback signature: HMAC-SHA256 of `orderId|paymentId`
   * keyed by the API **key secret** (not the webhook secret).
   *
   * This is what lets the browser's success callback be trusted without a
   * registered webhook: only Razorpay can produce this signature, so a client
   * cannot forge a payment. The webhook remains the more robust path (it still
   * fires if the user closes the tab mid-redirect), but this covers the common
   * case and is the only confirmation available until a webhook is registered.
   */
  verifyCheckoutSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const secret = this.config.get<string>('razorpay.keySecret');
    if (!secret || !orderId || !paymentId || !signature) return false;

    const expected = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Verify a Razorpay webhook signature over the raw request body.
   * Never trust a client-reported payment success — only a verified webhook.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const secret = this.config.get<string>('razorpay.webhookSecret');
    if (!secret || !signature) return false;

    const expected = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
