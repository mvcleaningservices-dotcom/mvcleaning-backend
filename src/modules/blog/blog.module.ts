import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogPost, BlogPostSchema } from './schemas/blog-post.schema';
import { BlogService } from './blog.service';
import { BlogController } from './blog.controller';
import { AdminBlogController } from './admin-blog.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BlogPost.name, schema: BlogPostSchema }]),
    ActivityLogModule,
  ],
  controllers: [BlogController, AdminBlogController],
  providers: [BlogService],
})
export class BlogModule {}
