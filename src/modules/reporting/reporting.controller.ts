import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/** Platform reporting — Super Admin exclusive (scope §4.3.3, §6.2). */
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('revenue')
  revenue(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reporting.revenue(from, to);
  }

  @Get('wallet-summary')
  walletSummary() {
    return this.reporting.walletSummary();
  }

  @Get('worker-performance')
  workerPerformance() {
    return this.reporting.workerPerformance();
  }
}
