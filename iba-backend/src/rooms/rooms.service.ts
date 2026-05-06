import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { IsString, IsNotEmpty, IsUUID, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @IsUUID()                                  building_id: string;
  @IsString()  @IsNotEmpty()                 name: string;
  @Type(()=>Number) @IsInt() @Min(1)         capacity: number;
  @IsIn(['Classroom','Seminar Hall','Computer Lab','Meeting Room'])  type: string;
}

@Injectable()
export class RoomsService {
  constructor(private supabase: SupabaseService) {}

  async findAll(buildingId?: string) {
    let query = this.supabase.db
      .from('rooms')
      .select('*, buildings(id, name, location)')
      .order('name');
    if (buildingId) query = query.eq('building_id', buildingId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from('rooms')
      .select('*, buildings(id, name, location)')
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('Room not found');
    return data;
  }

  /** Returns all bookings + blocked slots for a room on a given date */
  async getAvailability(roomId: string, date: string) {
    const [{ data: bookings }, { data: blocked }] = await Promise.all([
      this.supabase.db
        .from('bookings')
        .select('slot_id, status')
        .eq('room_id', roomId)
        .eq('date', date)
        .in('status', ['pending', 'approved']),
      this.supabase.db
        .from('blocked_slots')
        .select('slot_id, reason')
        .eq('room_id', roomId)
        .eq('date', date),
    ]);
    return { bookedSlots: bookings || [], blockedSlots: blocked || [] };
  }

  async create(dto: CreateRoomDto) {
    const { data, error } = await this.supabase.db
      .from('rooms')
      .insert({ building_id: dto.building_id, name: dto.name, capacity: dto.capacity, type: dto.type })
      .select('*, buildings(id, name)')
      .single();
    if (error) throw error;
    return data;
  }

  async remove(id: string) {
    const { error } = await this.supabase.db.from('rooms').delete().eq('id', id);
    if (error) throw error;
    return { message: 'Room deleted' };
  }
}
