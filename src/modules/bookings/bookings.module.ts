import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Booking, BookingSchema } from './schemas/booking.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PaymentController } from './payment.controller';
import { ServicesModule } from '../services/services.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
    ServicesModule,
    SettingsModule,
    PaymentsModule,
  ],
  controllers: [BookingsController, PaymentController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
