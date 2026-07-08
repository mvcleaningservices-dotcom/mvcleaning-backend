import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';

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

  /**
   * Update the caller's own profile: name, address, pincode (scope §3.2.7).
   * Always scoped to the authenticated user's own id — never a path param —
   * so there is no way to update another consumer's profile by guessing an id.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.pincode !== undefined) user.pincode = dto.pincode;
    await user.save();
    return user;
  }

  view(u: UserDocument) {
    return {
      id: u.id,
      mobile: u.mobile,
      name: u.name ?? null,
      address: u.address ?? '',
      pincode: u.pincode ?? '',
    };
  }
}
