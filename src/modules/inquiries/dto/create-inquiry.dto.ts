import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInquiryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message: string;

  /**
   * Honeypot spam-protection field: a hidden form input real users never
   * fill. Bots that auto-fill every field will populate it — any non-empty
   * value here causes the submission to be silently dropped (see
   * InquiriesController), without revealing to the bot that it was caught.
   */
  @IsOptional()
  @IsString()
  website?: string;
}
