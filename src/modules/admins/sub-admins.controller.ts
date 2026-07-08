import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminsService } from './admins.service';
import {
  CreateSubAdminDto,
  ResetPasswordDto,
  UpdateSubAdminDto,
} from './dto/sub-admin.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

/**
 * Sub Admin account management — Super Admin exclusive (scope §4.3.1, §6.2).
 */
@Controller('admin/sub-admins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SubAdminsController {
  constructor(
    private readonly admins: AdminsService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get()
  list() {
    return this.admins.listSubAdmins();
  }

  @Post()
  async create(
    @Body() dto: CreateSubAdminDto,
    @CurrentUser() current: AuthUser,
  ) {
    const admin = await this.admins.createSubAdmin(dto.username, dto.password);
    await this.activity.log(
      current.username ?? current.id,
      current.role,
      'sub_admin.create',
      `Created sub admin "${dto.username}"`,
    );
    return admin;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSubAdminDto,
    @CurrentUser() current: AuthUser,
  ) {
    if (dto.isActive === undefined) return this.admins.listSubAdmins();
    const admin = await this.admins.setSubAdminActive(id, dto.isActive);
    await this.activity.log(
      current.username ?? current.id,
      current.role,
      dto.isActive ? 'sub_admin.enable' : 'sub_admin.disable',
      `Sub admin "${admin.username}"`,
    );
    return admin;
  }

  @Patch(':id/password')
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() current: AuthUser,
  ) {
    const admin = await this.admins.resetSubAdminPassword(id, dto.password);
    await this.activity.log(
      current.username ?? current.id,
      current.role,
      'sub_admin.reset_password',
      `Sub admin "${admin.username}"`,
    );
    return admin;
  }
}
