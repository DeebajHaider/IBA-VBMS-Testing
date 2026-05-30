import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

export default async function globalSetup() {
  dotenv.config({
    path: path.resolve(__dirname, '../../iba-backend/.env.test'),
  });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  // Reset in reverse FK order
  await supabase.from('blocked_slots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('buildings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Seed users
  await supabase.from('users').insert([
    { erp: 'admin', name: 'Test Admin',  email: 'admin@test.iba', password: hash('admin123'),   role: 'admin' },
    { erp: 'po001', name: 'Test PO',     email: 'po@test.iba',    password: hash('po123'),      role: 'programoffice' },
    { erp: '12345', name: 'Student A',   email: 'a@test.iba',     password: hash('student123'), role: 'student' },
    { erp: '67890', name: 'Student B',   email: 'b@test.iba',     password: hash('student123'), role: 'student' },
  ]);

  // Seed a building and rooms
  const { data: building } = await supabase
    .from('buildings')
    .insert({ name: 'Test Block', location: 'Test Campus' })
    .select()
    .single();

  await supabase.from('rooms').insert([
    { building_id: building!.id, name: 'Room 101', capacity: 30, type: 'Classroom' },
    { building_id: building!.id, name: 'Lab 1',    capacity: 25, type: 'Computer Lab' },
  ]);

  console.log('✓ E2E database seeded with known test data');
}

