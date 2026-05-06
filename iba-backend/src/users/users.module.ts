// ── users.module.ts ──────────────────────────────────────────
import { Module } from '@nestjs/common';
import { UsersService }    from './users.service';
import { UsersController } from './users.controller';
import { AuthModule }      from '../auth/auth.module';

// @ts-ignore — single-file module pattern
@Module({ imports: [AuthModule], providers: [UsersService], controllers: [UsersController], exports: [UsersService] })
export class UsersModule {}
