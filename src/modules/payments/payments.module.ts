import { Module } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';

/**
 * Provides the Razorpay integration. Kept dependency-free so booking/wallet
 * modules can import it without creating circular dependencies.
 */
@Module({
  providers: [RazorpayService],
  exports: [RazorpayService],
})
export class PaymentsModule {}
