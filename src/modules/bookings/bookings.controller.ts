import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/types/jwt-payload';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CONSUMER)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  /** Create a booking + start advance payment (scope §3.1). */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user.id, dto);
  }

  /** The consumer's own bookings. */
  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.bookings.listMine(user.id);
  }

  /** Settle the final balance: part/all from wallet, remainder in cash. */
  @Post(':id/final-payment')
  payFinal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('walletAmount') walletAmount: number,
  ) {
    return this.bookings.payFinal(user.id, id, walletAmount);
  }
}
