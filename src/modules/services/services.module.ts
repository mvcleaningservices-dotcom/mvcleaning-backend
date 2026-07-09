import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Service, ServiceSchema } from './schemas/service.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { AdminServicesController } from './admin-services.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      // Read-only access to bookings for the "most booked" popularity query.
      { name: Booking.name, schema: BookingSchema },
    ]),
    ActivityLogModule,
  ],
  controllers: [ServicesController, AdminServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
