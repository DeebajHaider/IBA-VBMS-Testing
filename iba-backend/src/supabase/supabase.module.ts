import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global()   // Makes SupabaseService available everywhere without re-importing
@Module({
  providers: [SupabaseService],
  exports:   [SupabaseService],
})
export class SupabaseModule {}
