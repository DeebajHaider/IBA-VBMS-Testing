import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(
    private supabase: SupabaseService,
    private jwt: JwtService,
  ) {}

  async login(erp: string, password: string) {
    // 1. Find user by ERP/username
    const { data: user, error } = await this.supabase.db
      .from('users')
      .select('*')
      .eq('erp', erp)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Compare password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Issue JWT
    const payload = { sub: user.id, erp: user.erp, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: {
        id:    user.id,
        erp:   user.erp,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    };
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
