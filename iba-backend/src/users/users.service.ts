import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService }     from '../auth/auth.service';
import { IsString, IsEmail, IsNotEmpty, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsString()   @IsNotEmpty()  erp: string;
  @IsString()   @IsNotEmpty()  name: string;
  @IsEmail()                   email: string;
  @IsString()   @IsNotEmpty()  password: string;
  @IsIn(['student', 'programoffice', 'admin'])  role: string;
}

@Injectable()
export class UsersService {
  constructor(
    private supabase: SupabaseService,
    private authService: AuthService,
  ) {}

  async findAll() {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, erp, name, email, role, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, erp, name, email, role, created_at')
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('User not found');
    return data;
  }

  async create(dto: CreateUserDto) {
    // Check uniqueness
    const { data: existing } = await this.supabase.db
      .from('users').select('id').eq('erp', dto.erp).single();
    if (existing) throw new ConflictException('ERP/username already exists');

    const hashed = await this.authService.hashPassword(dto.password);

    const { data, error } = await this.supabase.db
      .from('users')
      .insert({ erp: dto.erp, name: dto.name, email: dto.email, password: hashed, role: dto.role })
      .select('id, erp, name, email, role, created_at')
      .single();

    if (error) throw error;
    return data;
  }

  async remove(id: string) {
    const { error } = await this.supabase.db.from('users').delete().eq('id', id);
    if (error) throw error;
    return { message: 'User deleted' };
  }
}
