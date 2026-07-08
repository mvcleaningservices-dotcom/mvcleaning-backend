import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PlatformSettings,
  PlatformSettingsDocument,
} from './schemas/platform-settings.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(PlatformSettings.name)
    private readonly model: Model<PlatformSettingsDocument>,
  ) {}

  /** Returns the settings doc, creating it with defaults on first access. */
  private async getOrCreate(): Promise<PlatformSettingsDocument> {
    return this.model
      .findOneAndUpdate(
        { key: 'platform' },
        { $setOnInsert: { key: 'platform' } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async getAdvanceAmount(): Promise<number> {
    const settings = await this.getOrCreate();
    return settings.advanceAmount;
  }

  /** Update the advance amount (used by Super Admin config in Phase 6). */
  async setAdvanceAmount(amount: number): Promise<number> {
    const settings = await this.model
      .findOneAndUpdate(
        { key: 'platform' },
        { $set: { advanceAmount: amount } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
    return settings.advanceAmount;
  }
}
