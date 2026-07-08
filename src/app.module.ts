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

// Feature modules are added here as each build phase implements them:
//   Phase 1: AuthModule (+ Users, Admins via Auth)          ← DONE
//   Phase 2: ServicesModule, SettingsModule, BookingsModule ← DONE (+ Payments via Bookings)
//   Phase 3: WorkersModule (+ AdminOrders via Bookings)     ← DONE
//   Phase 4: WalletModule
//   Phase 6: LeadsModule, ReportingModule

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

    // Global rate limiting — protects auth/OTP endpoints from abuse.
    // Default: 10 requests / 60s per IP (tightened per-route in Phase 1).
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),

    HealthModule,
    AuthModule,
    ServicesModule,
    SettingsModule,
    BookingsModule,
    WorkersModule,
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
