import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { RoomsService, CreateRoomDto } from './rooms.service';
import { JwtAuthGuard }        from '../auth/jwt-auth.guard';
import { RolesGuard, Roles }   from '../auth/roles.guard';

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private rooms: RoomsService) {}

  /** GET /api/rooms?building_id=xxx */
  @Get()
  findAll(@Query('building_id') buildingId?: string) {
    return this.rooms.findAll(buildingId);
  }

  /** GET /api/rooms/:id */
  @Get(':id')
  findOne(@Param('id') id: string) { return this.rooms.findOne(id); }

  /** GET /api/rooms/:id/availability?date=2025-06-10 */
  @Get(':id/availability')
  availability(@Param('id') id: string, @Query('date') date: string) {
    return this.rooms.getAvailability(id, date);
  }

  /** POST /api/rooms — Admin only */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateRoomDto) { return this.rooms.create(dto); }

  /** DELETE /api/rooms/:id — Admin only */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) { return this.rooms.remove(id); }
}
