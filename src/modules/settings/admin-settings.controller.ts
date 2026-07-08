import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateAdvanceAmountDto } from './dto/update-advance-amount.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

/**
 * Platform config — advance amount (scope §3.2.5, §6.2).
 * Super Admin exclusive: the access matrix gives Sub Admin NO access at all
 * to this setting, not even read-only.
 */
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get('advance-amount')
  async get() {
    return { amount: await this.settings.getAdvanceAmount() };
  }

  @Patch('advance-amount')
  async set(
    @Body() dto: UpdateAdvanceAmountDto,
    @CurrentUser() current: AuthUser,
  ) {
    const amount = await this.settings.setAdvanceAmount(dto.amount);
    await this.activity.log(
      current.username ?? current.id,
      current.role,
      'settings.advance_amount',
      `Set advance amount to ₹${amount}`,
    );
    return { amount };
  }
}
