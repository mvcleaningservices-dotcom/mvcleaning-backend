import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsArray()
  @Matches(/^\d{6}$/, { each: true, message: 'Each pincode must be 6 digits' })
  pincodes?: string[];
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsArray()
  @Matches(/^\d{6}$/, { each: true, message: 'Each pincode must be 6 digits' })
  pincodes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
