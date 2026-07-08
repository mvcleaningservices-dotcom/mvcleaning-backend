import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Sends SMS OTP via MSG91 (scope §2.1).
 *
 * If MSG91 credentials are not configured, runs in DEV MODE: instead of
 * sending a real SMS it logs the OTP to the server console (and never in
 * production). This lets the whole OTP flow be built and tested offline;
 * it flips to real MSG91 the moment credentials are added to .env.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  private get isLive(): boolean {
    return !!this.config.get<string>('msg91.authKey');
  }

  /**
   * True only in local dev with no SMS provider configured. Used to surface a
   * dev OTP hint for testing. NEVER true in production or with live MSG91.
   */
  get isDevMock(): boolean {
    return !this.isLive && this.config.get<string>('env') !== 'production';
  }

  async sendOtp(mobile: string, code: string): Promise<void> {
    if (!this.isLive) {
      if (this.config.get<string>('env') === 'production') {
        throw new Error(
          'MSG91 credentials required in production to send OTP SMS.',
        );
      }
      this.logger.warn(
        `[DEV OTP] No MSG91 key set — OTP for ${mobile} is: ${code}`,
      );
      return;
    }

    const authKey = this.config.get<string>('msg91.authKey');
    const templateId = this.config.get<string>('msg91.templateId');
    const senderId = this.config.get<string>('msg91.senderId');

    try {
      // MSG91 OTP flow API
      await axios.post(
        'https://control.msg91.com/api/v5/otp',
        {
          template_id: templateId,
          mobile,
          otp: code,
          sender: senderId,
        },
        { headers: { authkey: authKey } },
      );
    } catch (err) {
      this.logger.error(`MSG91 send failed for ${mobile}`, err?.message);
      throw new Error('Failed to send OTP. Please try again.');
    }
  }
}
