import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BlogPost, BlogPostDocument } from './schemas/blog-post.schema';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/blog-post.dto';

@Injectable()
export class BlogService implements OnModuleInit {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    @InjectModel(BlogPost.name)
    private readonly postModel: Model<BlogPostDocument>,
    private readonly config: ConfigService,
  ) {}

  /** Seed sample posts in dev so the marketing site has content to show. */
  async onModuleInit() {
    if (this.config.get<string>('env') === 'production') return;
    const count = await this.postModel.estimatedDocumentCount();
    if (count > 0) return;

    await this.postModel.insertMany([
      {
        title: '5 Signs Your Home Needs a Deep Clean',
        slug: '5-signs-your-home-needs-a-deep-clean',
        excerpt: 'From dust buildup to musty odors — here is how to tell it is time.',
        content:
          'Regular cleaning keeps the surface tidy, but a deep clean tackles what hides underneath. ' +
          'If you notice persistent odors, allergy flare-ups, or grime in hard-to-reach corners, it is ' +
          'time to book a professional deep clean with MV Cleaning Services.',
      },
      {
        title: 'How Our Booking Advance Works',
        slug: 'how-our-booking-advance-works',
        excerpt: 'A small advance confirms your slot — here is why, and how much.',
        content:
          'To reduce no-shows and keep our professionals scheduled efficiently, we collect a small ' +
          'advance payment when you book. The remaining balance is settled after the service, via ' +
          'wallet, UPI, or cash — whatever is easiest for you.',
      },
    ]);
    this.logger.log('Seeded sample blog posts (dev).');
  }

  /** Public: published posts only, newest first. */
  async listPublished() {
    const posts = await this.postModel
      .find({ published: true })
      .sort({ createdAt: -1 })
      .exec();
    return posts.map((p) => this.summary(p));
  }

  async getPublishedBySlug(slug: string) {
    const post = await this.postModel.findOne({ slug, published: true });
    if (!post) throw new NotFoundException('Post not found');
    return this.full(post);
  }

  /** Admin: every post regardless of published state. */
  async listAll() {
    const posts = await this.postModel.find().sort({ createdAt: -1 }).exec();
    return posts.map((p) => this.full(p));
  }

  async create(dto: CreateBlogPostDto) {
    const existing = await this.postModel.findOne({ slug: dto.slug });
    if (existing) throw new ConflictException('Slug already in use');
    const post = await this.postModel.create(dto);
    return this.full(post);
  }

  async update(id: string, dto: UpdateBlogPostDto) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');
    if (dto.title !== undefined) post.title = dto.title;
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt;
    if (dto.content !== undefined) post.content = dto.content;
    if (dto.published !== undefined) post.published = dto.published;
    await post.save();
    return this.full(post);
  }

  private summary(p: BlogPostDocument) {
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      publishedAt: (p as any).createdAt,
    };
  }

  private full(p: BlogPostDocument) {
    return {
      ...this.summary(p),
      content: p.content,
      published: p.published,
    };
  }
}
