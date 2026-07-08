import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { BookingsService } from './bookings.service';
import { RazorpayService } from '../payments/razorpay.service';
import { WalletService } from '../wallet/wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly razorpay: RazorpayService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Razorpay webhook — the ONLY trusted source of payment success.
   * Verifies the signature over the raw body, then idempotently confirms
   * the matching booking (scope: payment correctness).
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    if (!this.razorpay.verifyWebhookSignature(raw, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const body = req.body as any;
    const event = body?.event as string;

    // Extract the Razorpay order id + payment id from supported events.
    let orderId: string | undefined;
    let paymentId = '';
    if (event === 'order.paid') {
      orderId = body?.payload?.order?.entity?.id;
      paymentId = body?.payload?.payment?.entity?.id ?? '';
    } else if (event === 'payment.captured') {
      orderId = body?.payload?.payment?.entity?.order_id;
      paymentId = body?.payload?.payment?.entity?.id ?? '';
    }

    if (orderId) {
      // Try both — a given Razorpay order id belongs to exactly one of the
      // two flows (booking advance or wallet top-up); the other is a no-op.
      await this.bookings.confirmAdvanceByRazorpayOrder(orderId, paymentId);
      await this.wallet.confirmTopupByRazorpayOrder(orderId);
    }
    return { received: true };
  }

  /**
   * DEV-ONLY: simulate a successful advance payment in test mode (no Razorpay
   * keys). Disabled in production and when live keys are configured.
   */
  @Post('test-confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONSUMER)
  async testConfirm(
    @CurrentUser() user: AuthUser,
    @Body('bookingId') bookingId: string,
  ) {
    if (this.config.get<string>('env') === 'production' || this.razorpay.isLive) {
      throw new ForbiddenException('Test confirmation is not available');
    }
    return this.bookings.confirmAdvanceTest(bookingId, user.id);
  }
}
