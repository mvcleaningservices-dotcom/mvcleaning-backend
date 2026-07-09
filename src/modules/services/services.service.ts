import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@Injectable()
export class ServicesService implements OnModuleInit {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly config: ConfigService,
  ) {}

  /** Seed a few sample services in development so the app has data to show. */
  async onModuleInit() {
    if (this.config.get<string>('env') === 'production') return;
    const count = await this.serviceModel.estimatedDocumentCount();
    if (count > 0) return;

    const pincodes = ['560001', '560002', '560003'];
    // Dev seed only. imageUrl uses a stable placeholder image service so the
    // consumer grid demonstrates real remote images; admins set proper photos.
    const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/400`;
    await this.serviceModel.insertMany([
      { name: 'Deep Cleaning', description: 'Full home deep clean', price: 1499, pincodes, category: 'Cleaning', imageUrl: img('deepclean') },
      { name: 'Bathroom Cleaning', description: 'Complete bathroom sanitation', price: 499, pincodes, category: 'Cleaning', imageUrl: img('bathroom') },
      { name: 'Sofa Cleaning', description: 'Shampoo & vacuum, per seat', price: 349, pincodes, category: 'Cleaning', imageUrl: img('sofa') },
      { name: 'Kitchen Cleaning', description: 'Degrease & sanitize kitchen', price: 899, pincodes: ['560001', '560002'], category: 'Cleaning', imageUrl: img('kitchen') },
      { name: 'Plumbing', description: 'Tap, pipe & leak repairs', price: 299, pincodes: ['560001'], category: 'Repair', imageUrl: img('plumbing') },
    ]);
    this.logger.log('Seeded sample services (dev).');
  }

  /** All active services platform-wide — marketing site Services page (scope §5). */
  async listAllActive() {
    return this.serviceModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  /**
   * List active services available in a pincode (scope §3.2.2).
   * Optional case-insensitive name search.
   */
  async listAvailable(pincode: string, search?: string) {
    const filter: Record<string, unknown> = {
      isActive: true,
      pincodes: pincode,
    };
    if (search?.trim()) {
      filter.name = { $regex: this.escapeRegex(search.trim()), $options: 'i' };
    }
    return this.serviceModel.find(filter).sort({ name: 1 }).exec();
  }

  /** Fetch active services by id (used when creating a booking). */
  async findActiveByIds(ids: string[]) {
    const objectIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    return this.serviceModel
      .find({ _id: { $in: objectIds }, isActive: true })
      .exec();
  }

  private escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ---- Admin CRUD (scope §4.3.2) ----

  /** All services regardless of active state — admin catalog view. */
  async listAll() {
    const services = await this.serviceModel.find().sort({ name: 1 }).exec();
    return services.map((s) => this.view(s));
  }

  async create(dto: CreateServiceDto) {
    const service = await this.serviceModel.create({
      name: dto.name,
      description: dto.description ?? '',
      price: dto.price,
      pincodes: dto.pincodes ?? [],
      imageUrl: dto.imageUrl ?? '',
      category: dto.category ?? '',
    });
    return this.view(service);
  }

  async update(id: string, dto: UpdateServiceDto) {
    const service = await this.serviceModel.findById(id);
    if (!service) throw new NotFoundException('Service not found');
    if (dto.name !== undefined) service.name = dto.name;
    if (dto.description !== undefined) service.description = dto.description;
    if (dto.price !== undefined) service.price = dto.price;
    if (dto.pincodes !== undefined) service.pincodes = dto.pincodes;
    if (dto.imageUrl !== undefined) service.imageUrl = dto.imageUrl;
    if (dto.category !== undefined) service.category = dto.category;
    if (dto.isActive !== undefined) service.isActive = dto.isActive;
    await service.save();
    return this.view(service);
  }

  /**
   * Most-booked active services in a pincode, derived from real order data
   * (scope §3.2 "popular" surfacing). Excludes cancelled orders and services
   * with zero bookings — so the consumer "Popular" section only ever shows
   * genuine popularity, never a fabricated figure.
   */
  async mostBooked(pincode: string, limit = 6) {
    const counts = await this.bookingModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      { $match: { pincode, status: { $ne: OrderStatus.CANCELLED } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.service', count: { $sum: 1 } } },
    ]);
    const countById = new Map(counts.map((c) => [String(c._id), c.count]));

    const services = await this.serviceModel
      .find({ isActive: true, pincodes: pincode })
      .exec();

    return services
      .map((s) => ({ ...this.view(s), bookingCount: countById.get(s.id) ?? 0 }))
      .filter((s) => s.bookingCount > 0)
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, limit);
  }

  view(s: ServiceDocument) {
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      pincodes: s.pincodes,
      imageUrl: s.imageUrl,
      category: s.category,
      isActive: s.isActive,
    };
  }
}
