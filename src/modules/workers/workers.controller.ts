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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/**
 * Worker profile management (scope §4.4.2). Admin-only (both Super and Sub
 * Admin per §6.2). Workers themselves have no app/login.
 */
@Controller('admin/workers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.SUB_ADMIN)
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  @Get()
  async list(@Query('activeOnly') activeOnly?: string) {
    const workers = await this.workers.list(activeOnly === 'true');
    return workers.map((w) => this.workers.view(w));
  }

  @Post()
  async create(@Body() dto: CreateWorkerDto) {
    const worker = await this.workers.create(dto);
    return this.workers.view(worker);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    const worker = await this.workers.update(id, dto);
    return this.workers.view(worker);
  }
}
