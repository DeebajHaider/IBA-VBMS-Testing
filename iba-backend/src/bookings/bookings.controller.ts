import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { BookingsService, CreateBookingDto } from './bookings.service';
import { JwtAuthGuard }        from '../auth/jwt-auth.guard';
import { RolesGuard, Roles }   from '../auth/roles.guard';
import { CurrentUser }         from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  /**
   * GET /api/bookings
   * ?status=pending|approved|rejected|cancelled
   * ?mine=true  (returns only the logged-in user's bookings)
   * Admin/PO see all; students see only their own
   */
  @Get()
  findAll(
    @Query('status') status: string,
    @Query('mine') mine: string,
    @CurrentUser() user: any,
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    // Students always see only their own
    if (user.role === 'student' || mine === 'true') filters.userId = user.id;
    return this.bookings.findAll(filters);
  }

  /** GET /api/bookings/:id */
  @Get(':id')
  findOne(@Param('id') id: string) { return this.bookings.findOne(id); }

  /** POST /api/bookings — Student or PO creates a booking */
  @Post()
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: any) {
    return this.bookings.create(user.id, dto);
  }

  /** PATCH /api/bookings/:id/approve — PO or Admin */
  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'programoffice')
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookings.updateStatus(id, 'approved', user.id);
  }

  /** PATCH /api/bookings/:id/reject — PO or Admin */
  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin', 'programoffice')
  reject(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookings.updateStatus(id, 'rejected', user.id);
  }

  /** PATCH /api/bookings/:id/cancel — Owner, PO or Admin */
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookings.cancel(id, user.id, user.role);
  }
}
