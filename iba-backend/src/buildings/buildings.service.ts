import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateBuildingDto {
  @IsString() @IsNotEmpty()  name: string;
  @IsString() @IsOptional()  location?: string;
}

@Injectable()
export class BuildingsService {
  constructor(private supabase: SupabaseService) {}

  async findAll() {
    const { data, error } = await this.supabase.db
      .from('buildings')
      .select('*, rooms(id, name, capacity, type)')
      .order('name');
    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from('buildings')
      .select('*, rooms(id, name, capacity, type)')
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('Building not found');
    return data;
  }

  async create(dto: CreateBuildingDto) {
    const { data, error } = await this.supabase.db
      .from('buildings')
      .insert({ name: dto.name, location: dto.location || '' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async remove(id: string) {
    // Cascades to rooms via FK
    const { error } = await this.supabase.db.from('buildings').delete().eq('id', id);
    if (error) throw error;
    return { message: 'Building and all its rooms deleted' };
  }
}
