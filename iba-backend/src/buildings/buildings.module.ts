// buildings.module.ts
import { Module } from '@nestjs/common';
import { BuildingsService }    from './buildings.service';
import { BuildingsController } from './buildings.controller';
import { AuthModule }          from '../auth/auth.module';

@Module({ imports: [AuthModule], providers: [BuildingsService], controllers: [BuildingsController] })
export class BuildingsModule {}
