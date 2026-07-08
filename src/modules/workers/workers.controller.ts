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
import { WorkersService } from './workers.service';
import { CreateWorkerDto, UpdateWorkerDto } from './dto/worker.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

/**
 * Worker profile management (scope §4.4.2). Admin-only (both Super and Sub
 * Admin per §6.2). Workers themselves have no app/login.
 */
@Controller('admin/workers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.SUB_ADMIN)
export class WorkersController {
  constructor(
    private readonly workers: WorkersService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get()
  async list(@Query('activeOnly') activeOnly?: string) {
    const workers = await this.workers.list(activeOnly === 'true');
    return workers.map((w) => this.workers.view(w));
  }

  @Post()
  async create(@Body() dto: CreateWorkerDto, @CurrentUser() admin: AuthUser) {
    const worker = await this.workers.create(dto);
    const view = this.workers.view(worker);
    this.activity
      .log(admin.username ?? admin.id, admin.role, 'worker.create', view.name)
      .catch(() => {});
    return view;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkerDto,
    @CurrentUser() admin: AuthUser,
  ) {
    const worker = await this.workers.update(id, dto);
    const view = this.workers.view(worker);
    this.activity
      .log(admin.username ?? admin.id, admin.role, 'worker.update', view.name)
      .catch(() => {});
    return view;
  }
}
