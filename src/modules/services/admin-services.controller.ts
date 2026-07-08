import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

/**
 * Service & area (pincode) management (scope §4.3.2, §6.2).
 * Read: both Super and Sub Admin. Write: Super Admin only (Sub Admin is
 * read-only per the access matrix).
 */
@Controller('admin/services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SUB_ADMIN)
  list() {
    return this.services.listAll();
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(@Body() dto: CreateServiceDto, @CurrentUser() current: AuthUser) {
    const service = await this.services.create(dto);
    await this.activity.log(
      current.username ?? current.id,
      current.role,
      'service.create',
      `Created service "${service.name}" (₹${service.price})`,
    );
    return service;
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() current: AuthUser,
  ) {
    const service = await this.services.update(id, dto);
    await this.activity.log(
      current.username ?? current.id,
      current.role,
      'service.update',
      `Updated service "${service.name}"`,
    );
    return service;
  }
}
