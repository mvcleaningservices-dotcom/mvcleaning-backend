import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBookingDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Select at least one service' })
  @IsString({ each: true })
  serviceIds: string[];

  /** How to pay the advance: online gateway (default) or wallet balance. */
  @IsOptional()
  @IsIn(['razorpay', 'wallet'])
  advanceMethod?: 'razorpay' | 'wallet';

  /** ISO date YYYY-MM-DD. */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'scheduledDate must be YYYY-MM-DD' })
  scheduledDate: string;

  @IsString()
  @MinLength(3)
  timeSlot: string;

  @IsString()
  @MinLength(5, { message: 'A complete address is required' })
  @MaxLength(500)
  address: string;

  /**
   * Service area. REQUIRED — it's how the order gets routed to a worker and how
   * admin filters orders by area, so a booking without one is undispatchable.
   *
   * This was previously optional, which was only survivable because the apps
   * happened to always send it (the homepage pincode gate guaranteed it). Now
   * that the web homepage is browsable without a pincode, that guarantee is gone
   * and the server has to enforce it itself.
   */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'A valid 6-digit pincode is required' })
  pincode: string;
}
