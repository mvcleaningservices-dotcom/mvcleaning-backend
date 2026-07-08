import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^(\+?91)?[6-9]\d{9}$/, {
    message: 'A valid 10-digit Indian mobile number is required',
  })
  mobile: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  code: string;
}
