import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSubAdminDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}

export class UpdateSubAdminDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}
