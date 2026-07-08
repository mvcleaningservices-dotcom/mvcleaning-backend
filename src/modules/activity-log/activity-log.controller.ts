import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/** Super Admin views the activity log of all admin actions (scope §4.3.1). */
@Controller('admin/activity-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class ActivityLogController {
  constructor(private readonly logs: ActivityLogService) {}

  @Get()
  list(@Query('adminUsername') adminUsername?: string) {
    return this.logs.list(adminUsername);
  }
}
