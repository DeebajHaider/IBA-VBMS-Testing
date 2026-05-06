import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService, CreateUserDto } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard }   from '../auth/roles.guard';
import { Roles }        from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  /** GET /api/users — Admin only */
  @Get()
  @Roles('admin')
  findAll() { return this.users.findAll(); }

  /** GET /api/users/:id */
  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string) { return this.users.findOne(id); }

  /** POST /api/users — Admin only: create student or PO */
  @Post()
  @Roles('admin')
  create(@Body() dto: CreateUserDto) { return this.users.create(dto); }

  /** DELETE /api/users/:id — Admin only */
  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) { return this.users.remove(id); }
}
