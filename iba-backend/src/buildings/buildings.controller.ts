import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { BuildingsService, CreateBuildingDto } from './buildings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard)
@Controller('buildings')
export class BuildingsController {
  constructor(private buildings: BuildingsService) {}

  /** GET /api/buildings — All logged-in users */
  @Get()
  findAll() { return this.buildings.findAll(); }

  /** GET /api/buildings/:id */
  @Get(':id')
  findOne(@Param('id') id: string) { return this.buildings.findOne(id); }

  /** POST /api/buildings — Admin only */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateBuildingDto) { return this.buildings.create(dto); }

  /** DELETE /api/buildings/:id — Admin only */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) { return this.buildings.remove(id); }
}
