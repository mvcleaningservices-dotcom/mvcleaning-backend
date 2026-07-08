import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsInt, IsString, Min } from 'class-validator';
import { WalletService } from './wallet.service';
import { RazorpayService } from '../payments/razorpay.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

class TopupDto {
  @IsInt()
  @Min(1)
  amount: number;
}

class TopupConfirmDto {
  @IsString()
  transactionId: string;
}

/** Consumer wallet: balance, history, top-up (scope §3.2.4). */
@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CONSUMER)
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly razorpay: RazorpayService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    const [balance, history] = await Promise.all([
      this.wallet.getBalance(user.id),
      this.wallet.history(user.id),
    ]);
    return { balance, history };
  }

  @Post('topup')
  topup(@CurrentUser() user: AuthUser, @Body() dto: TopupDto) {
    return this.wallet.createTopup(user.id, dto.amount);
  }

  /** DEV-ONLY: simulate a successful top-up in test mode. */
  @Post('topup/test-confirm')
  testConfirm(@CurrentUser() user: AuthUser, @Body() dto: TopupConfirmDto) {
    if (this.config.get<string>('env') === 'production' || this.razorpay.isLive) {
      throw new ForbiddenException('Test confirmation is not available');
    }
    return this.wallet.confirmTopupTest(dto.transactionId, user.id);
  }
}
