import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BlogService } from './blog.service';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/blog-post.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

/**
 * Blog content management — Super Admin exclusive (scope §6.2, "Static
 * Content: Manage all pages", Super Admin only).
 */
@Controller('admin/blog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminBlogController {
  constructor(
    private readonly blog: BlogService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get()
  list() {
    return this.blog.listAll();
  }

  @Post()
  async create(@Body() dto: CreateBlogPostDto, @CurrentUser() admin: AuthUser) {
    const post = await this.blog.create(dto);
    this.activity
      .log(admin.username ?? admin.id, admin.role, 'blog.create', post.title)
      .catch(() => {});
    return post;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBlogPostDto,
    @CurrentUser() admin: AuthUser,
  ) {
    const post = await this.blog.update(id, dto);
    this.activity
      .log(admin.username ?? admin.id, admin.role, 'blog.update', post.title)
      .catch(() => {});
    return post;
  }
}
