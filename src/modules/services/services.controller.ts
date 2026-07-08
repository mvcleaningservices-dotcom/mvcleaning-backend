import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  /**
   * GET /api/services?pincode=560001&search=clean
   * Public — the app lists services available in the entered pincode.
   */
  @Get()
  async list(
    @Query('pincode') pincode?: string,
    @Query('search') search?: string,
  ) {
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      throw new BadRequestException('A valid 6-digit pincode is required');
    }
    const services = await this.services.listAvailable(pincode, search);
    return services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
    }));
  }
}
