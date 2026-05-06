// blocked-slots.module.ts
import { Module } from '@nestjs/common';
import { BlockedSlotsService }    from './blocked-slots.service';
import { BlockedSlotsController } from './blocked-slots.controller';
import { AuthModule }             from '../auth/auth.module';

@Module({ imports: [AuthModule], providers: [BlockedSlotsService], controllers: [BlockedSlotsController] })
export class BlockedSlotsModule {}
