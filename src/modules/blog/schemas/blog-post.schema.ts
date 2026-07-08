import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BlogPostDocument = HydratedDocument<BlogPost>;

/**
 * A blog article (scope §5 — "Blog: Articles on cleaning tips, service
 * updates, and company news"). Super Admin manages content (scope §6.2 —
 * "Static Content: Manage all pages", Super Admin exclusive).
 */
@Schema({ timestamps: true })
export class BlogPost {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, index: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ required: true, trim: true })
  excerpt: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: true })
  published: boolean;
}

export const BlogPostSchema = SchemaFactory.createForClass(BlogPost);
