import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Did globalSetup.ts load .env.test correctly?'
    );
  }

  return createClient(url, key);
}

export async function resetDatabase(): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase.from('blocked_slots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('buildings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

export async function seedTestData() {
  const supabase = getSupabaseClient();
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const { data: users, error: usersError } = await supabase
    .from('users')
    .insert([
      { erp: 'admin',  name: 'Test Admin',   email: 'admin@test.iba', password: hash('admin123'),   role: 'admin' },
      { erp: 'po001',  name: 'Test PO',      email: 'po@test.iba',    password: hash('po123'),      role: 'programoffice' },
      { erp: '12345',  name: 'Student A',    email: 'a@test.iba',     password: hash('student123'), role: 'student' },
      { erp: '67890',  name: 'Student B',    email: 'b@test.iba',     password: hash('student123'), role: 'student' },
    ])
    .select();

  if (usersError) throw new Error(`seed users failed: ${usersError.message}`);

  const { data: building, error: buildingError } = await supabase
    .from('buildings')
    .insert({ name: 'Test Block', location: 'Test Campus' })
    .select()
    .single();

  if (buildingError) throw new Error(`seed building failed: ${buildingError.message}`);

  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .insert([
      { building_id: building.id, name: 'Room 101', capacity: 30, type: 'Classroom' },
      { building_id: building.id, name: 'Lab 1',    capacity: 25, type: 'Computer Lab' },
    ])
    .select();

  if (roomsError) throw new Error(`seed rooms failed: ${roomsError.message}`);

  return { users, building, rooms };
}
