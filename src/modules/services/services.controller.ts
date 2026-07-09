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
      imageUrl: s.imageUrl,
      category: s.category,
    }));
  }

  /**
   * GET /api/services/popular?pincode=560001
   * Public — most-booked services in the area, from real order data. Returns
   * an empty list (not an error) when there aren't enough bookings yet, so the
   * app can simply hide the section rather than show anything fabricated.
   */
  @Get('popular')
  async popular(@Query('pincode') pincode?: string) {
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      throw new BadRequestException('A valid 6-digit pincode is required');
    }
    return this.services.mostBooked(pincode);
  }

  /**
   * GET /api/services/catalog
   * Public, no pincode required — the marketing site's "Services" page lists
   * every active service platform-wide (scope §5), unlike the app's
   * area-filtered discovery flow.
   */
  @Get('catalog')
  async catalog() {
    const services = await this.services.listAllActive();
    return services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      imageUrl: s.imageUrl,
      category: s.category,
    }));
  }
}
