import { Controller, Post, Body } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString() @IsNotEmpty() erp: string;
  @IsString() @IsNotEmpty() password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /**
   * POST /api/auth/login
   * Body: { erp, password }
   * Returns: { access_token, user }
   */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.erp, dto.password);
  }
}
