import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InquiriesService } from './inquiries.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiryType } from './schemas/inquiry.schema';

/**
 * Public Contact Us / Become a Partner forms (scope §5).
 * Rate-limited against spam/abuse in addition to the honeypot field.
 */
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post('contact')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  contact(@Body() dto: CreateInquiryDto) {
    return this.inquiries.create(InquiryType.CONTACT, dto);
  }

  @Post('partner')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  partner(@Body() dto: CreateInquiryDto) {
    return this.inquiries.create(InquiryType.PARTNER, dto);
  }
}
