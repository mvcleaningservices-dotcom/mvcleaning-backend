import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inquiry, InquiryDocument, InquiryType } from './schemas/inquiry.schema';
import { CreateInquiryDto } from './dto/create-inquiry.dto';

@Injectable()
export class InquiriesService {
  constructor(
    @InjectModel(Inquiry.name)
    private readonly inquiryModel: Model<InquiryDocument>,
  ) {}

  async create(type: InquiryType, dto: CreateInquiryDto) {
    // Honeypot tripped — silently drop without erroring (don't tip off bots).
    if (dto.website) {
      return { received: true };
    }
    await this.inquiryModel.create({
      type,
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? '',
      message: dto.message,
    });
    return { received: true };
  }

  async list(type?: InquiryType) {
    const filter = type ? { type } : {};
    const entries = await this.inquiryModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();
    return entries.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      email: e.email,
      phone: e.phone,
      message: e.message,
      resolved: e.resolved,
      at: (e as any).createdAt,
    }));
  }

  async markResolved(id: string, resolved: boolean) {
    await this.inquiryModel.findByIdAndUpdate(id, { resolved });
    return { ok: true };
  }
}
