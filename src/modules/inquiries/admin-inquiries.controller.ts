import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { InquiriesService } from './inquiries.service';
import { InquiryType } from './schemas/inquiry.schema';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/** Admin view of contact/partner inquiries — Super Admin exclusive. */
@Controller('admin/inquiries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminInquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  list(@Query('type') type?: InquiryType) {
    return this.inquiries.list(type);
  }

  @Patch(':id')
  markResolved(@Param('id') id: string, @Body('resolved') resolved: boolean) {
    return this.inquiries.markResolved(id, resolved);
  }
}
