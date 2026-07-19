import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Admin, AdminSchema } from './schemas/admin.schema';
import { AdminsService } from './admins.service';
import { SubAdminsController } from './sub-admins.controller';
import { AccountController } from './account.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
    ActivityLogModule,
  ],
  controllers: [SubAdminsController, AccountController],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}
