import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';

import { Otp, OtpDocument } from './schemas/otp.schema';
import { SmsService } from './sms/sms.service';
import { UsersService } from '../users/users.service';
import { AdminsService } from '../admins/admins.service';
import { LeadsService } from '../leads/leads.service';
import { WorkersService } from '../workers/workers.service';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/types/jwt-payload';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(Otp.name) private readonly otpModel: Model<OtpDocument>,
    private readonly sms: SmsService,
    private readonly users: UsersService,
    private readonly admins: AdminsService,
    private readonly leads: LeadsService,
    private readonly workers: WorkersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Normalize to a bare 10-digit number so +91/91 variants map to one identity. */
  private normalizeMobile(mobile: string): string {
    return mobile.replace(/\D/g, '').slice(-10);
  }

  /**
   * Generate + store a hashed OTP and send it. Any prior OTP for this number
   * is discarded so only the newest code is valid.
   */
  async requestOtp(
    rawMobile: string,
  ): Promise<{ message: string; devOtp?: string }> {
    const mobile = this.normalizeMobile(rawMobile);
    const code = randomInt(100000, 1000000).toString(); // 6 digits
    const codeHash = await bcrypt.hash(code, 10);

    await this.otpModel.deleteMany({ mobile });
    await this.otpModel.create({
      mobile,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await this.sms.sendOtp(mobile, code);

    // In local dev (no SMS provider), return the code so the app can show a
    // test hint. Strictly gated — never present in production or with live SMS.
    if (this.sms.isDevMock) {
      return { message: 'OTP sent', devOtp: code };
    }
    return { message: 'OTP sent' };
  }

  /**
   * Verify the OTP; on success create/find the consumer and issue a JWT.
   * Returns a long-lived token to support app auto-login (scope §3.2.1).
   */
  async verifyOtp(rawMobile: string, code: string) {
    const mobile = this.normalizeMobile(rawMobile);
    const otp = await this.otpModel.findOne({ mobile }).sort({ createdAt: -1 });

    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('OTP expired or not requested');
    }
    if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.otpModel.deleteMany({ mobile });
      throw new UnauthorizedException(
        'Too many incorrect attempts. Request a new OTP.',
      );
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      otp.attempts += 1;
      await otp.save();
      throw new UnauthorizedException('Incorrect OTP');
    }

    // Success — consume the OTP and log the user in.
    await this.otpModel.deleteMany({ mobile });
    const user = await this.users.findOrCreateByMobile(mobile);

    // Log this login as a sales follow-up candidate (scope §4.4.4). Never let a
    // logging failure block login — but surface it, because a silently dropped
    // lead is invisible in the admin panel (it just looks like nobody logged in).
    this.leads
      .logLogin(user.id, user.mobile)
      .catch((err: Error) =>
        this.logger.warn(`Lead logging failed for ${mobile}: ${err.message}`),
      );

    const token = this.signToken(
      { sub: user.id, role: Role.CONSUMER },
      this.config.get<string>('jwt.consumerExpiresIn') || '30d',
    );

    return {
      accessToken: token,
      user: { id: user.id, mobile: user.mobile, name: user.name ?? null },
    };
  }

  /**
   * Admin username/password login (scope §4.2). No OTP for admins.
   * Issues a shorter-lived token → enforces admin session timeout.
   */
  async adminLogin(username: string, password: string) {
    const admin = await this.admins.findByUsername(username);
    // Same generic error whether user missing or password wrong (no enumeration).
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await this.admins.verifyPassword(password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.signToken(
      { sub: admin.id, role: admin.role, username: admin.username },
      this.config.get<string>('jwt.adminExpiresIn') || '1d',
    );

    return {
      accessToken: token,
      admin: { id: admin.id, username: admin.username, role: admin.role },
    };
  }

  /**
   * Service Partner (worker) login. Optional feature — only workers an admin
   * gave a username/password can log in, and their token is scoped to their own
   * worker id with the SERVICE_PARTNER role, which the admin RolesGuards reject.
   */
  async partnerLogin(username: string, password: string) {
    const worker = await this.workers.findByUsername(username);
    // Same generic error for missing/inactive/no-login/wrong-password.
    if (!worker || !worker.isActive || !worker.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await this.workers.verifyPassword(password, worker.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = this.signToken(
      { sub: worker.id, role: Role.SERVICE_PARTNER, username: worker.username },
      this.config.get<string>('jwt.adminExpiresIn') || '1d',
    );
    return {
      accessToken: token,
      partner: { id: worker.id, name: worker.name, username: worker.username },
    };
  }

  private signToken(payload: JwtPayload, expiresIn: string): string {
    const secret = this.config.get<string>('jwt.secret');
    if (!secret) {
      throw new BadRequestException('Server auth is not configured');
    }
    // expiresIn is a validated config string (e.g. '30d'); the JwtService typing
    // wants a stricter literal type, so cast the options object.
    return this.jwt.sign(payload, {
      secret,
      expiresIn,
    } as JwtSignOptions);
  }
}
