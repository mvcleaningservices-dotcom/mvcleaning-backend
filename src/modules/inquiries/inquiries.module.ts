import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Inquiry, InquirySchema } from './schemas/inquiry.schema';
import { InquiriesService } from './inquiries.service';
import { InquiriesController } from './inquiries.controller';
import { AdminInquiriesController } from './admin-inquiries.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Inquiry.name, schema: InquirySchema }]),
  ],
  controllers: [InquiriesController, AdminInquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}
