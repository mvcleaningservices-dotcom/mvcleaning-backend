import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminOrdersService } from './admin-orders.service';
import {
  AddNoteDto,
  AddProofDto,
  AssignWorkerDto,
  CancelOrderDto,
  ReassignWorkerDto,
  UpdateStatusDto,
} from './dto/admin-order.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

/**
 * Admin order lifecycle + worker ops (scope §4.4). Both Super and Sub Admin
 * (§6.2). RBAC enforced server-side. adminUsername is resolved from the token
 * id for the audit trail.
 */
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.SUB_ADMIN)
export class AdminOrdersController {
  constructor(
    private readonly orders: AdminOrdersService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('workerId') workerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('area') area?: string,
  ) {
    return this.orders.list({ status, workerId, from, to, area });
  }

  @Get('workers/:workerId/summary')
  workerSummary(@Param('workerId') workerId: string) {
    return this.orders.workerSummary(workerId);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.orders.detail(id);
  }

  @Post(':id/assign')
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignWorkerDto,
    @CurrentUser() admin: AuthUser,
  ) {
    const result = await this.orders.assign(id, dto.workerId, admin.username ?? admin.id);
    this.activity
      .log(admin.username ?? admin.id, admin.role, 'order.assign', `${result.orderNumber} -> ${result.assignedWorkerName}`)
      .catch(() => {});
    return result;
  }

  @Post(':id/reassign')
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignWorkerDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.orders.reassign(id, dto.workerId, dto.reason, admin.username ?? admin.id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() admin: AuthUser,
  ) {
    const result = await this.orders.updateStatus(id, dto.status, admin.username ?? admin.id);
    this.activity
      .log(admin.username ?? admin.id, admin.role, 'order.status', `${result.orderNumber} -> ${dto.status}`)
      .catch(() => {});
    return result;
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string, @CurrentUser() admin: AuthUser) {
    const result = await this.orders.complete(id, admin.username ?? admin.id);
    this.activity
      .log(admin.username ?? admin.id, admin.role, 'order.complete', result.orderNumber)
      .catch(() => {});
    return result;
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() admin: AuthUser,
  ) {
    const result = await this.orders.cancel(id, dto.reason ?? '', admin.username ?? admin.id);
    this.activity
      .log(admin.username ?? admin.id, admin.role, 'order.cancel', `${result.orderNumber}: ${dto.reason ?? ''}`)
      .catch(() => {});
    return result;
  }

  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.orders.addNote(id, dto.text, admin.username ?? admin.id);
  }

  @Post(':id/proof')
  addProof(@Param('id') id: string, @Body() dto: AddProofDto) {
    return this.orders.addProof(id, dto.imageData);
  }
}
