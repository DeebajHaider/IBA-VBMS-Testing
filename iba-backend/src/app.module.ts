import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule }      from './supabase/supabase.module';
import { AuthModule }          from './auth/auth.module';
import { UsersModule }         from './users/users.module';
import { BuildingsModule }     from './buildings/buildings.module';
import { RoomsModule }         from './rooms/rooms.module';
import { BookingsModule }      from './bookings/bookings.module';
import { BlockedSlotsModule }  from './blocked-slots/blocked-slots.module';
import { TimeSlotsModule }     from './time-slots/time-slots.module';

@Module({
  imports: [
    // Load .env file globally
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    UsersModule,
    BuildingsModule,
    RoomsModule,
    BookingsModule,
    BlockedSlotsModule,
    TimeSlotsModule,
  ],
})
export class AppModule {}
