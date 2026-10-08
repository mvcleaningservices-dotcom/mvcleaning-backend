import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Sends OTP SMS via the Omnichannel HTTP API (DLT-compliant, STPL-registered).
 *
 * API method: JSON POST to /fe/api/v1/message with HTTP Basic auth — keeps the
 * username/password out of the URL (GET query-string credentials end up in
 * server/proxy access logs and browser history).
 *
 * If credentials are not configured, runs in DEV MODE: logs the OTP to the
 * server console instead of sending a real SMS. Flips to live SMS the moment
 * SMS_DOMAIN / SMS_USERNAME / SMS_PASSWORD are set in .env.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  /** DLT-approved message template. {code} is replaced at send time. */
  private readonly OTP_TEMPLATE =
    'Dear Customer, your OTP for login to https://www.mvcleaningservices.in/ is {code}. ' +
    'Please do not share it with anyone. - MV Cleaning Services';

  constructor(private readonly config: ConfigService) {}

  /** Live only when all three required credentials are present in .env. */
  private get isLive(): boolean {
    return !!(
      this.config.get<string>('sms.domain') &&
      this.config.get<string>('sms.username') &&
      this.config.get<string>('sms.password')
    );
  }

  /**
   * True only in local dev with no SMS provider configured. Used to surface a
   * dev OTP hint in the app for testing. NEVER true in production or with live SMS.
   */
  get isDevMock(): boolean {
    return !this.isLive && this.config.get<string>('env') !== 'production';
  }

  async sendOtp(mobile: string, code: string): Promise<void> {
    if (!this.isLive) {
      if (this.config.get<string>('env') === 'production') {
        throw new Error(
          'SMS provider credentials required in production to send OTP SMS.',
        );
      }
      // Dev mode — log OTP to console so the developer can test without a real SIM.
      this.logger.warn(
        `[DEV OTP] No SMS provider configured — OTP for ${mobile} is: ${code}`,
      );
      return;
    }

    const domain       = this.config.get<string>('sms.domain');
    const username     = this.config.get<string>('sms.username');
    const password     = this.config.get<string>('sms.password');
    const senderId     = this.config.get<string>('sms.senderId')     || 'MVCLSS';
    const dltContentId = this.config.get<string>('sms.dltContentId') || '1777179085282340380';

    // Substitute the OTP into the DLT-approved template.
    const text = this.OTP_TEMPLATE.replace('{code}', code);

    // API requires recipient with country code (91 for India).
    const recipient = `91${mobile}`;

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    let data: {
      transactionId?: number;
      state?: string;
      statusCode?: number;
      description?: string;
    };

    try {
      const response = await axios.post(
        `https://${domain}/fe/api/v1/message`,
        {
          extra: { dltContentId },
          message: { recipient, text },
          sender: senderId,
          unicode: false, // English-only OTP text
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 10000,
        },
      );
      data = response.data;
    } catch (err: any) {
      // The gateway may answer an error (e.g. 2070) with a non-2xx status —
      // axios throws, but the JSON body still carries the statusCode.
      if (err?.response?.data?.statusCode) {
        data = err.response.data;
      } else {
        this.logger.error(
          `SMS gateway network error for ${mobile}`,
          err?.message,
        );
        throw new Error('Failed to send OTP. Please try again.');
      }
    }

    // ── Parse gateway response ─────────────────────────────────────────────
    if (data.state !== 'SUBMIT_ACCEPTED') {
      const errMsg = this.resolveGatewayError(data.statusCode, data.description);
      this.logger.error(
        `OTP SMS rejected for ${mobile}: [${data.statusCode}] ${data.description}`,
      );
      throw new Error(errMsg);
    }

    this.logger.log(
      `OTP SMS sent to ${mobile} — transactionId: ${data.transactionId}`,
    );
  }

  /**
   * Maps Omnichannel gateway status codes to user-safe (and ops-useful) messages.
   * Status codes as per API documentation §6.
   */
  private resolveGatewayError(statusCode?: number, fallback?: string): string {
    switch (statusCode) {
      case 2051:
        // Sender ID not registered on panel.
        return 'OTP send failed: sender ID not registered. Please contact support.';
      case 2054:
        // MSISDN not in 10- or 12-digit length.
        return 'OTP send failed: invalid mobile number format.';
      case 2070:
        // Invalid username / password / account expired.
        return 'OTP send failed: SMS gateway authentication error. Please contact support.';
      case 6001:
        // Zero SMS credit.
        return 'OTP send failed: insufficient SMS balance. Please contact support.';
      case 7001:
        // DLT Content ID missing or not found.
        return 'OTP send failed: DLT content ID not found. Please contact support.';
      default:
        return fallback || 'Failed to send OTP. Please try again.';
    }
  }
}
