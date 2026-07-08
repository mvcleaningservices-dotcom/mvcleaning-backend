import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  /** Indian mobile number: 10 digits, optionally prefixed with +91/91. */
  @IsString()
  @Matches(/^(\+?91)?[6-9]\d{9}$/, {
    message: 'A valid 10-digit Indian mobile number is required',
  })
  mobile: string;
}
