// time-slots.module.ts
import { Module } from '@nestjs/common';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { JwtAuthGuard }   from '../auth/jwt-auth.guard';
import { AuthModule }     from '../auth/auth.module';

@Injectable()
export class TimeSlotsService {
  constructor(private supabase: SupabaseService) {}
  async findAll() {
    const { data, error } = await this.supabase.db
      .from('time_slots').select('*').order('id');
    if (error) throw error;
    return data;
  }
}

@Controller('time-slots')
export class TimeSlotsController {
  constructor(private ts: TimeSlotsService) {}
  /** GET /api/time-slots */
  @Get() findAll() { return this.ts.findAll(); }
}

@Module({
  imports:     [AuthModule],
  providers:   [TimeSlotsService],
  controllers: [TimeSlotsController],
})
export class TimeSlotsModule {}
