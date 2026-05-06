import { Module } from '@nestjs/common';
import { BookingsService }    from './bookings.service';
import { BookingsController } from './bookings.controller';
import { AuthModule }         from '../auth/auth.module';

@Module({ imports: [AuthModule], providers: [BookingsService], controllers: [BookingsController] })
export class BookingsModule {}
