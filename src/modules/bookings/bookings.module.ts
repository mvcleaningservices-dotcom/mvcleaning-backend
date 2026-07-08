import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Booking, BookingSchema } from './schemas/booking.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PaymentController } from './payment.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminOrdersController } from './admin-orders.controller';
import { ServicesModule } from '../services/services.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentsModule } from '../payments/payments.module';
import { WorkersModule } from '../workers/workers.module';
import { WalletModule } from '../wallet/wallet.module';
import { LeadsModule } from '../leads/leads.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
    ServicesModule,
    SettingsModule,
    PaymentsModule,
    WorkersModule,
    WalletModule,
    LeadsModule,
    ActivityLogModule,
  ],
  controllers: [BookingsController, PaymentController, AdminOrdersController],
  providers: [BookingsService, AdminOrdersService],
  exports: [BookingsService],
})
export class BookingsModule {}
