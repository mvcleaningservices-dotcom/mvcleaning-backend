import { IsString, Matches, MaxLength } from 'class-validator';

/**
 * Payload returned by Razorpay Checkout to the browser on success, forwarded
 * here so the server can verify the signature before confirming the booking.
 * The global ValidationPipe runs with `forbidNonWhitelisted`, so every field
 * the client sends must be declared.
 */
export class VerifyPaymentDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^order_[A-Za-z0-9]+$/, { message: 'Invalid Razorpay order id' })
  razorpayOrderId: string;

  @IsString()
  @MaxLength(64)
  @Matches(/^pay_[A-Za-z0-9]+$/, { message: 'Invalid Razorpay payment id' })
  razorpayPaymentId: string;

  /** HMAC-SHA256 hex digest — always 64 hex chars. */
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Invalid signature' })
  razorpaySignature: string;
}
