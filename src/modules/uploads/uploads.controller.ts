import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/** Which folders the client is allowed to request a signature for. */
const ALLOWED_FOLDERS = ['mv-cleaning/blog', 'mv-cleaning/services'] as const;

class SignUploadDto {
  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_FOLDERS)
  folder?: (typeof ALLOWED_FOLDERS)[number];
}

/**
 * Admin-only signed-upload endpoint. Any admin can request a signature to upload
 * a content image (blog cover, service photo) straight to Cloudinary.
 */
@Controller('admin/upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.SUB_ADMIN)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('signature')
  signature(@Body() dto: SignUploadDto) {
    return this.uploads.signUpload(dto.folder ?? 'mv-cleaning/blog');
  }
}
