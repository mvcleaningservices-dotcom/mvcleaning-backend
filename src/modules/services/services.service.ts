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
    // Dev seed. imageUrl is left empty so the app uses its bundled, name-matched
    // service images (mobile/assets/services/*); admins can set a custom URL per
    // service to override.
    await this.serviceModel.insertMany([
      // Cleaning
      { name: 'Deep Cleaning', description: 'Top-to-bottom clean for your entire home.', price: 1499, pincodes, category: 'Cleaning' },
      { name: 'Bathroom Cleaning', description: 'Complete sanitation of tiles, fixtures & fittings.', price: 499, pincodes, category: 'Cleaning' },
      { name: 'Kitchen Cleaning', description: 'Degrease, de-grime and sanitize your kitchen.', price: 899, pincodes, category: 'Cleaning' },
      { name: 'Sofa Cleaning', description: 'Shampoo & vacuum, priced per seat.', price: 349, pincodes, category: 'Cleaning' },
      { name: 'Carpet Cleaning', description: 'Deep shampoo and stain removal for carpets.', price: 599, pincodes, category: 'Cleaning' },
      { name: 'Window Cleaning', description: 'Streak-free glass, frames and sills.', price: 399, pincodes, category: 'Cleaning' },
      // Repair
      { name: 'Plumbing', description: 'Tap, pipe and leak repairs by verified pros.', price: 299, pincodes, category: 'Repair' },
      { name: 'Electrical Repair', description: 'Switches, wiring, fixtures and fault fixing.', price: 349, pincodes, category: 'Repair' },
      { name: 'Appliance Repair', description: 'Diagnosis and repair of home appliances.', price: 449, pincodes, category: 'Repair' },
      // Pest Control
      { name: 'Pest Control', description: 'Safe treatment for cockroaches, ants and more.', price: 799, pincodes, category: 'Pest Control' },
      { name: 'Home Sanitization', description: 'Full-home disinfection and sanitization.', price: 999, pincodes, category: 'Pest Control' },
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
  /**
   * Active services, optionally narrowed to an area and/or a search term.
   *
   * `pincode` is optional: without one we return the whole catalogue, which is
   * what a visitor (or a crawler) sees before they've told us where they are.
   * Search is done here rather than in the client so it keeps working as the
   * catalogue grows — the {isActive, pincodes} index covers the filtered case.
   */
  async listAvailable(pincode?: string, search?: string) {
    const filter: Record<string, unknown> = { isActive: true };
    if (pincode) {
      filter.pincodes = pincode;
    }
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
