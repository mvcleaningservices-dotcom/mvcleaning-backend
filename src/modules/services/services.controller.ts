import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  /**
   * GET /api/services?pincode=560001&search=clean
   *
   * Public discovery. BOTH query params are optional:
   *   - no pincode → every active service (a first-time visitor, or a crawler,
   *     browsing before they've told us where they are)
   *   - pincode    → only services offered in that area
   *   - search     → works with or without a pincode
   *
   * pincode used to be mandatory here, which meant the site could not show a
   * single service until the visitor typed one — so Google only ever indexed an
   * empty pincode form, and every new user hit a wall before seeing what we sell.
   * Availability is now confirmed at checkout, where it's actually needed.
   */
  @Get()
  async list(
    @Query('pincode') pincode?: string,
    @Query('search') search?: string,
  ) {
    // Only validate the format when one is supplied; absence is legitimate.
    if (pincode && !/^\d{6}$/.test(pincode)) {
      throw new BadRequestException('Pincode must be 6 digits');
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
