import { Controller, Get, Param } from '@nestjs/common';
import { BlogService } from './blog.service';

/** Public blog — marketing site (scope §5). */
@Controller('blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  list() {
    return this.blog.listPublished();
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.blog.getPublishedBySlug(slug);
  }
}
