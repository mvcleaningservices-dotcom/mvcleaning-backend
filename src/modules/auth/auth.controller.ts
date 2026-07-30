import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UsersService } from '../users/users.service';
import { AdminsService } from '../admins/admins.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/jwt-payload';
import { Role } from '../../common/enums/role.enum';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly admins: AdminsService,
  ) {}

  /** Consumer: request an SMS OTP. Extra-tight rate limit against SMS abuse. */
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.mobile);
  }

  /** Consumer: verify OTP → returns JWT (long-lived for auto-login) + user. */
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.mobile, dto.code);
  }

  /** Admin (Super/Sub): username + password → returns JWT (session-scoped). */
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto.username, dto.password);
  }

  /** Service Partner (worker) login — optional worker portal access. */
  @Post('partner/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  partnerLogin(@Body() dto: AdminLoginDto) {
    return this.auth.partnerLogin(dto.username, dto.password);
  }

  /** Returns the current authenticated identity — used by the app for auto-login. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: AuthUser) {
    if (current.role === Role.CONSUMER) {
      const user = await this.users.findById(current.id);
      if (!user) throw new UnauthorizedException();
      return {
        role: current.role,
        user: { id: user.id, mobile: user.mobile, name: user.name ?? null },
      };
    }

    const admin = await this.admins.findById(current.id);
    if (!admin || !admin.isActive) throw new UnauthorizedException();
    return {
      role: current.role,
      admin: { id: admin.id, username: admin.username, role: admin.role },
    };
  }
}
