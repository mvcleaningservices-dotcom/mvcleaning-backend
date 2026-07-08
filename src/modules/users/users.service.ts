import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  findByMobile(mobile: string) {
    return this.userModel.findOne({ mobile }).exec();
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  /**
   * Returns the user for this mobile, creating one on first login.
   * Also stamps lastLoginAt (used by the Customer Database view, scope §4.4.3).
   */
  async findOrCreateByMobile(mobile: string): Promise<UserDocument> {
    const now = new Date();
    return this.userModel
      .findOneAndUpdate(
        { mobile },
        { $set: { lastLoginAt: now }, $setOnInsert: { mobile } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
