import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityLog, ActivityLogDocument } from './schemas/activity-log.schema';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectModel(ActivityLog.name)
    private readonly logModel: Model<ActivityLogDocument>,
  ) {}

  log(adminUsername: string, role: string, action: string, details = '') {
    // Fire-and-forget-ish but awaited by caller when they choose to; errors
    // here should never block the actual admin action, so callers may
    // .catch() this if desired. Kept simple for MVP.
    return this.logModel.create({ adminUsername, role, action, details });
  }

  async list(adminUsername?: string, limit = 200) {
    const filter = adminUsername ? { adminUsername } : {};
    const entries = await this.logModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return entries.map((e) => ({
      id: e.id,
      adminUsername: e.adminUsername,
      role: e.role,
      action: e.action,
      details: e.details,
      at: (e as any).createdAt,
    }));
  }
}
