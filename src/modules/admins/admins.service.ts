import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Admin, AdminDocument } from './schemas/admin.schema';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class AdminsService implements OnModuleInit {
  private readonly logger = new Logger(AdminsService.name);

  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Seed the initial Super Admin from env if none exists yet.
   * A platform needs at least one Super Admin to bootstrap (scope §4.3).
   */
  async onModuleInit() {
    const username = this.config.get<string>('superAdmin.username');
    const password = this.config.get<string>('superAdmin.password');
    if (!username || !password) {
      this.logger.warn(
        'SUPER_ADMIN_USERNAME/PASSWORD not set — skipping Super Admin seed.',
      );
      return;
    }

    const existing = await this.adminModel.findOne({
      role: Role.SUPER_ADMIN,
    });
    if (existing) return;

    await this.create(username, password, Role.SUPER_ADMIN);
    this.logger.log(`Seeded initial Super Admin "${username}".`);
  }

  findByUsername(username: string) {
    return this.adminModel.findOne({ username }).exec();
  }

  findById(id: string) {
    return this.adminModel.findById(id).exec();
  }

  async create(
    username: string,
    password: string,
    role: Role.SUPER_ADMIN | Role.SUB_ADMIN,
  ): Promise<AdminDocument> {
    const passwordHash = await bcrypt.hash(password, 10);
    return this.adminModel.create({ username, passwordHash, role });
  }

  verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /** All Sub Admin accounts (scope §4.3.1) — Super Admin management list. */
  async listSubAdmins() {
    const admins = await this.adminModel
      .find({ role: Role.SUB_ADMIN })
      .sort({ username: 1 })
      .exec();
    return admins.map((a) => this.view(a));
  }

  async createSubAdmin(username: string, password: string) {
    const existing = await this.findByUsername(username);
    if (existing) {
      throw new ConflictException('Username already in use');
    }
    const admin = await this.create(username, password, Role.SUB_ADMIN);
    return this.view(admin);
  }

  async setSubAdminActive(id: string, isActive: boolean) {
    const admin = await this.adminModel.findOne({ _id: id, role: Role.SUB_ADMIN });
    if (!admin) throw new NotFoundException('Sub Admin not found');
    admin.isActive = isActive;
    await admin.save();
    return this.view(admin);
  }

  /**
   * Change the signed-in admin's OWN password (any role, including Super Admin).
   * Requires the current password — so a stolen session alone can't lock the
   * real owner out. This is the supported way to rotate the Super Admin password
   * without deleting the seeded record in the database.
   */
  async changeOwnPassword(id: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    const admin = await this.findById(id);
    if (!admin) throw new NotFoundException('Admin not found');

    const ok = await this.verifyPassword(currentPassword, admin.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();
    return { success: true };
  }

  async resetSubAdminPassword(id: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    const admin = await this.adminModel.findOne({ _id: id, role: Role.SUB_ADMIN });
    if (!admin) throw new NotFoundException('Sub Admin not found');
    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();
    return this.view(admin);
  }

  view(a: AdminDocument) {
    return {
      id: a.id,
      username: a.username,
      role: a.role,
      isActive: a.isActive,
    };
  }
}
