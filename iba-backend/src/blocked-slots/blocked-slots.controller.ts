import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { BlockedSlotsService, CreateBlockedSlotDto } from './blocked-slots.service';
import { JwtAuthGuard }       from '../auth/jwt-auth.guard';
import { RolesGuard, Roles }  from '../auth/roles.guard';
import { CurrentUser }        from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('blocked-slots')
export class BlockedSlotsController {
  constructor(private blocked: BlockedSlotsService) {}

  /** GET /api/blocked-slots?room_id=xxx&date=2025-06-10 */
  @Get()
  findAll(@Query('room_id') roomId?: string, @Query('date') date?: string) {
    return this.blocked.findAll(roomId, date);
  }

  /** POST /api/blocked-slots — Admin only */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateBlockedSlotDto, @CurrentUser() user: any) {
    return this.blocked.create(user.id, dto);
  }

  /** DELETE /api/blocked-slots/:id — Admin only */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) { return this.blocked.remove(id); }
}
