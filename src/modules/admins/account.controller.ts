import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { AdminsService } from './admins.service';
import { ChangePasswordDto } from './dto/sub-admin.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

/**
 * The signed-in admin's own account. Any admin (Super or Sub) may change their
 * OWN password here — this is the supported way to rotate the Super Admin
 * password, since the env-based seed never overwrites an existing account.
 */
@Controller('admin/account')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.SUB_ADMIN)
export class AccountController {
  constructor(
    private readonly admins: AdminsService,
    private readonly activity: ActivityLogService,
  ) {}

  @Patch('password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() current: AuthUser,
  ) {
    const res = await this.admins.changeOwnPassword(
      current.id,
      dto.currentPassword,
      dto.newPassword,
    );
    await this.activity.log(
      current.username ?? current.id,
      current.role,
      'admin.change_password',
      'Changed own password',
    );
    return res;
  }
}
