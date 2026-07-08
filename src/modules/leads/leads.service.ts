import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument, LeadStatus } from './schemas/lead.schema';

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
  ) {}

  /** Log a consumer login as a follow-up candidate (scope §4.4.4). */
  logLogin(userId: string, mobile: string) {
    return this.leadModel.create({
      user: new Types.ObjectId(userId),
      mobile,
      loginAt: new Date(),
      status: LeadStatus.NEW,
    });
  }

  /**
   * Called when a booking is created: mark the consumer's most recent
   * unconverted lead as CONVERTED, linking the resulting order number.
   * A no-op if there's no pending lead (e.g. booking without a prior
   * logged login — shouldn't happen in practice, but never blocks booking).
   */
  async markConvertedIfPending(userId: string, orderNumber: string) {
    await this.leadModel.findOneAndUpdate(
      {
        user: new Types.ObjectId(userId),
        status: { $ne: LeadStatus.CONVERTED },
      },
      {
        $set: {
          status: LeadStatus.CONVERTED,
          convertedOrderNumber: orderNumber,
        },
      },
      { sort: { loginAt: -1 } },
    );
  }

  async list(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const leads = await this.leadModel
      .find(filter)
      .sort({ loginAt: -1 })
      .populate('user', 'name')
      .limit(200)
      .exec();
    return leads.map((l) => this.view(l));
  }

  async updateStatus(id: string, status: LeadStatus) {
    if (!Object.values(LeadStatus).includes(status)) {
      throw new BadRequestException('Invalid lead status');
    }
    const lead = await this.leadModel.findById(id);
    if (!lead) throw new NotFoundException('Lead not found');
    lead.status = status;
    await lead.save();
    return this.view(lead);
  }

  private view(l: LeadDocument) {
    const user = l.user as any;
    const minutesSinceLogin = Math.round(
      (Date.now() - new Date(l.loginAt).getTime()) / 60000,
    );
    return {
      id: l.id,
      name: user?.name ?? null,
      mobile: l.mobile,
      loginAt: l.loginAt,
      minutesSinceLogin,
      status: l.status,
      convertedOrderNumber: l.convertedOrderNumber ?? null,
    };
  }
}
