import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
}
