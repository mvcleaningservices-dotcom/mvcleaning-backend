import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityLog, ActivityLogDocument } from './schemas/activity-log.schema';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectModel(ActivityLog.name)
    private readonly logModel: Model<ActivityLogDocument>,
  ) {}

  /**
   * Record an admin action for the audit trail.
   *
   * Never rejects: an audit-write failure must not roll back the admin action
   * the operator just performed. But it is reported to the server log rather
   * than swallowed — a silently broken audit trail is indistinguishable from
   * "no admin activity", which is exactly the failure you cannot afford to
   * discover during an incident.
   */
  async log(adminUsername: string, role: string, action: string, details = '') {
    try {
      await this.logModel.create({ adminUsername, role, action, details });
    } catch (err) {
      this.logger.error(
        `AUDIT WRITE FAILED — ${adminUsername} (${role}) "${action}" was NOT recorded: ${
          (err as Error).message
        }`,
      );
    }
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
