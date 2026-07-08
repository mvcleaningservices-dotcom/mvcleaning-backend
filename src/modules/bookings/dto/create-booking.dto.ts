import {
  ArrayNotEmpty,
  IsArray,
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
}
