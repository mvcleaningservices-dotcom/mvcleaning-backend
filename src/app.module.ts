import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import { buildMongooseOptions } from './config/database';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ServicesModule } from './modules/services/services.module';
import { SettingsModule } from './modules/settings/settings.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { WorkersModule } from './modules/workers/workers.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { LeadsModule } from './modules/leads/leads.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { BlogModule } from './modules/blog/blog.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { PartnerModule } from './modules/partner/partner.module';

// Feature modules are added here as each build phase implements them:
//   Phase 1: AuthModule (+ Users, Admins via Auth)          ← DONE
//   Phase 2: ServicesModule, SettingsModule, BookingsModule ← DONE (+ Payments via Bookings)
//   Phase 3: WorkersModule (+ AdminOrders via Bookings)     ← DONE
//   Phase 4: WalletModule                                   ← DONE
//   Phase 6: LeadsModule, CustomersModule, ReportingModule  ← DONE (+ SubAdmins via Admins,
//            Service/Settings admin CRUD via their modules, ActivityLogModule shared)
//   Phase 7: BlogModule, InquiriesModule                    ← DONE

@Module({
  imports: [
    // Global typed config from .env
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // MongoDB connection (URI from .env — see .env.example).
    // Falls back to in-memory Mongo in dev when MONGODB_URI is empty.
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildMongooseOptions,
    }),

    // Global rate limiting. This is the FLOOR for every route; the endpoints
    // that actually invite abuse (OTP request/verify) set their own much tighter
    // limits via @Throttle and are unaffected by this number.
    //
    // 10/min was far too low for real use: opening one admin order is already
    // ~3 requests (list + detail + workers) and every action triggers a refresh,
    // and a customer browsing hits several endpoints per screen — so normal usage
    // tripped a 429. 100/min per IP leaves genuine bursts room while still capping
    // a scripted flood.
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    HealthModule,
    AuthModule,
    ServicesModule,
    SettingsModule,
    BookingsModule,
    WorkersModule,
    WalletModule,
    LeadsModule,
    CustomersModule,
    ReportingModule,
    BlogModule,
    InquiriesModule,
    UploadsModule,
    PartnerModule,
  ],
  providers: [
    // Apply rate limiting globally.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
