import { Controller, Get, UseGuards } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

/**
 * Service Partner portal (optional worker login). Everything is locked to the
 * SERVICE_PARTNER role and scoped to the caller's own worker id — a partner can
 * never reach admin endpoints, nor read another partner's data.
 */
@Controller('partner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SERVICE_PARTNER)
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.partner.me(u.id);
  }

  @Get('orders')
  orders(@CurrentUser() u: AuthUser) {
    return this.partner.orders(u.id);
  }

  @Get('earnings')
  earnings(@CurrentUser() u: AuthUser) {
    return this.partner.earnings(u.id);
  }
}
