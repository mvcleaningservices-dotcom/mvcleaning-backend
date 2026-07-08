import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

/**
 * Consumer profile & settings (scope §3.2.7).
 * Every route is scoped to @CurrentUser() — never a path :id — so a consumer
 * can only ever read/edit their own profile, no ID-guessing possible.
 */
@Controller('users/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CONSUMER)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async getProfile(@CurrentUser() current: AuthUser) {
    const user = await this.users.findById(current.id);
    if (!user) throw new NotFoundException('User not found');
    return this.users.view(user);
  }

  @Patch()
  async updateProfile(
    @CurrentUser() current: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.users.updateProfile(current.id, dto);
    return this.users.view(user);
  }
}
