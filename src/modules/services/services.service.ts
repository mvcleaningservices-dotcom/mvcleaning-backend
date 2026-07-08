import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';

@Injectable()
export class ServicesService implements OnModuleInit {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
    private readonly config: ConfigService,
  ) {}

  /** Seed a few sample services in development so the app has data to show. */
  async onModuleInit() {
    if (this.config.get<string>('env') === 'production') return;
    const count = await this.serviceModel.estimatedDocumentCount();
    if (count > 0) return;

    const pincodes = ['560001', '560002', '560003'];
    await this.serviceModel.insertMany([
      { name: 'Deep Cleaning', description: 'Full home deep clean', price: 1499, pincodes },
      { name: 'Bathroom Cleaning', description: 'Complete bathroom sanitation', price: 499, pincodes },
      { name: 'Sofa Cleaning', description: 'Shampoo & vacuum, per seat', price: 349, pincodes },
      { name: 'Kitchen Cleaning', description: 'Degrease & sanitize kitchen', price: 899, pincodes: ['560001', '560002'] },
      { name: 'Plumbing', description: 'Tap, pipe & leak repairs', price: 299, pincodes: ['560001'] },
    ]);
    this.logger.log('Seeded sample services (dev).');
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
}
