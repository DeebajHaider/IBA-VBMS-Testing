import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { IsUUID, IsInt, IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @IsUUID()                    room_id: string;
  @IsDateString()              date: string;
  @Type(()=>Number) @IsInt()   slot_id: number;
  @IsString() @IsNotEmpty()    purpose: string;
}

const SELECT = `
  id, date, slot_id, purpose, status, created_at, updated_at,
  users!bookings_user_id_fkey(id, erp, name, email),
  rooms(id, name, buildings(id, name)),
  time_slots(id, start_time, end_time, label)
`;

@Injectable()
export class BookingsService {
  constructor(private supabase: SupabaseService) {}

  async findAll(filters: { status?: string; userId?: string } = {}) {
    let q = this.supabase.db.from('bookings').select(SELECT).order('created_at', { ascending: false });
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.userId) q = q.eq('user_id', filters.userId);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from('bookings').select(SELECT).eq('id', id).single();
    if (error || !data) throw new NotFoundException('Booking not found');
    return data;
  }

  async create(userId: string, dto: CreateBookingDto) {
    // 1. Check for blocked slot
    const { data: blocked } = await this.supabase.db
      .from('blocked_slots')
      .select('id')
      .eq('room_id', dto.room_id)
      .eq('date', dto.date)
      .eq('slot_id', dto.slot_id)
      .single();
    if (blocked) throw new ConflictException('This slot is blocked by admin');

    // 2. Check for existing booking (unique constraint handles race conditions too)
    const { data: existing } = await this.supabase.db
      .from('bookings')
      .select('id')
      .eq('room_id', dto.room_id)
      .eq('date', dto.date)
      .eq('slot_id', dto.slot_id)
      .in('status', ['pending', 'approved'])
      .single();
    if (existing) throw new ConflictException('This slot is already booked');

    const { data, error } = await this.supabase.db
      .from('bookings')
      .insert({ user_id: userId, room_id: dto.room_id, date: dto.date, slot_id: dto.slot_id, purpose: dto.purpose, status: 'pending' })
      .select(SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  async updateStatus(id: string, status: 'approved' | 'rejected', reviewerId: string) {
    const { data, error } = await this.supabase.db
      .from('bookings')
      .update({ status, reviewed_by: reviewerId })
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) throw new NotFoundException('Booking not found');
    return data;
  }

  async cancel(id: string, requesterId: string, requesterRole: string) {
    const booking = await this.findOne(id);

    // Only the owner or admin/PO can cancel
    if (requesterRole === 'student' && (booking as any).users?.id !== requesterId) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }
    if (!['pending', 'approved'].includes((booking as any).status)) {
      throw new BadRequestException('Only pending or approved bookings can be cancelled');
    }

    return this.updateStatus(id, 'rejected', requesterId);
  }
}
