import { Injectable, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { IsUUID, IsInt, IsString, IsOptional, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBlockedSlotDto {
  @IsUUID()               room_id: string;
  @IsDateString()         date: string;
  @IsArray() @IsInt({ each: true }) slot_ids: number[];
  @IsString() @IsOptional() reason?: string;
}

const SELECT = `
  id, date, slot_id, reason, created_at,
  rooms(id, name, buildings(id, name)),
  time_slots(id, start_time, end_time, label),
  users!blocked_slots_blocked_by_fkey(id, name)
`;

@Injectable()
export class BlockedSlotsService {
  constructor(private supabase: SupabaseService) {}

  async findAll(roomId?: string, date?: string) {
    let q = this.supabase.db.from('blocked_slots').select(SELECT).order('date');
    if (roomId) q = q.eq('room_id', roomId);
    if (date)   q = q.eq('date', date);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async create(adminId: string, dto: CreateBlockedSlotDto) {
    const rows = dto.slot_ids.map(slot_id => ({
      room_id:    dto.room_id,
      date:       dto.date,
      slot_id,
      reason:     dto.reason || 'Admin Block',
      blocked_by: adminId,
    }));

    // upsert — silently skips already-blocked slots
    const { data, error } = await this.supabase.db
      .from('blocked_slots')
      .upsert(rows, { onConflict: 'room_id,date,slot_id' })
      .select(SELECT);
    if (error) throw error;
    return data;
  }

  async remove(id: string) {
    const { error } = await this.supabase.db.from('blocked_slots').delete().eq('id', id);
    if (error) throw error;
    return { message: 'Slot unblocked' };
  }
}
