import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { Otp, OtpSchema } from './schemas/otp.schema';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SmsService } from './sms/sms.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AdminsModule } from '../admins/admins.module';
import { LeadsModule } from '../leads/leads.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Otp.name, schema: OtpSchema }]),
    PassportModule,
    JwtModule.register({}), // secret/expiry passed per-sign in AuthService
    UsersModule,
    AdminsModule,
    LeadsModule,
    WorkersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SmsService, JwtStrategy],
})
export class AuthModule {}
