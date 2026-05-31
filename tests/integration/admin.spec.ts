import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp } from './helpers/setup';
import { resetDatabase, seedTestData } from './helpers/seed';
import { loginAs } from './helpers/auth';

describe('Admin API', () => {
  let app: INestApplication;
  let adminToken: string;
  let studentToken: string;
  let seededRooms: any[];

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    const seed = await seedTestData();
    seededRooms = seed.rooms;
    adminToken   = (await loginAs(app, 'admin',  'admin123')).token;
    studentToken = (await loginAs(app, '12345',  'student123')).token;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── API-ADMIN-001 ─────────────────────────────────────────────────────────

  it('API-ADMIN-001: admin creates a student account — returns 201 without password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        erp:      'new001',
        name:     'New Student',
        email:    'new@iba.edu.pk',
        password: 'pw123',
        role:     'student',
      });

    expect(res.status).toBe(201);
    expect(res.body.erp).toBe('new001');
    expect(res.body.role).toBe('student');
    // id and created_at must exist — confirms the row was actually inserted
    expect(res.body.id).toBeDefined();
    expect(res.body.created_at).toBeDefined();
    // The password must never appear in any user-facing response
    expect(res.body.password).toBeUndefined();
  });

  // ── API-ADMIN-002 ─────────────────────────────────────────────────────────

  it('API-ADMIN-002: duplicate ERP → 409 Conflict', async () => {
    const payload = {
      erp:      'dup001',
      name:     'First User',
      email:    'first@iba.edu.pk',
      password: 'pw123',
      role:     'student',
    };

    // First creation must succeed
    const first = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(first.status).toBe(201);

    // Second creation with the same ERP must be rejected
    const second = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, email: 'second@iba.edu.pk' }); // different email, same erp

    expect(second.status).toBe(409);
    expect(second.body.message.toLowerCase()).toContain('already exists');
  });

  // ── API-ADMIN-002b ────────────────────────────────────────────────────────

  it('API-ADMIN-002b: invalid email format → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        erp:      'val001',
        name:     'Val User',
        email:    'not-an-email',  // fails @IsEmail()
        password: 'pw123',
        role:     'student',
      });

    expect(res.status).toBe(400);
    // message is an array of validation error objects; we serialise it to search easily
    expect(JSON.stringify(res.body.message)).toContain('email');
  });

  it('API-ADMIN-002b: invalid role value → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        erp:      'val002',
        name:     'Val User',
        email:    'val@iba.edu.pk',
        password: 'pw123',
        role:     'superuser',   // not in ['student', 'programoffice', 'admin']
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('role');
  });

  it('API-ADMIN-003: admin creates PO account; new PO can immediately log in', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/users').set('Authorization', `Bearer ${adminToken}`)
      .send({ erp: 'newpo', name: 'New PO', email: 'newpo@iba.edu.pk', password: 'po456', role: 'programoffice' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.role).toBe('programoffice');

    // State chain: use the credentials we just created to attempt a real login.
    // If password hashing broke at any point, bcrypt.compare will fail and this returns 401.
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ erp: 'newpo', password: 'po456' });

    expect(loginRes.status).toBe(201);
    expect(loginRes.body.user.role).toBe('programoffice');
    expect(loginRes.body.access_token).toMatch(/^eyJ/);
  });

  it('API-ADMIN-004: admin creates a building — returns 201 with id', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/buildings').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Wing', location: 'East Campus' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Wing');
    expect(res.body.id).toBeDefined();
  });

  it('API-ADMIN-005: admin creates a room; room appears in subsequent GET', async () => {
    // First create the building to get a real building_id
    const buildingRes = await request(app.getHttpServer())
      .post('/api/buildings').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Block', location: 'South' });
    expect(buildingRes.status).toBe(201);
    const buildingId = buildingRes.body.id;

    const roomRes = await request(app.getHttpServer())
      .post('/api/rooms').set('Authorization', `Bearer ${adminToken}`)
      .send({ building_id: buildingId, name: 'Room 301', capacity: 30, type: 'Classroom' });

    expect(roomRes.status).toBe(201);
    expect(roomRes.body.name).toBe('Room 301');
    expect(roomRes.body.capacity).toBe(30);

    // Verify the room actually exists in the database by reading it back
    const listRes = await request(app.getHttpServer())
      .get(`/api/rooms?building_id=${buildingId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    const names = listRes.body.map((r: any) => r.name);
    expect(names).toContain('Room 301');
  });

  it('API-ADMIN-005b: capacity ≤ 0 and invalid type → 400', async () => {
    const buildingRes = await request(app.getHttpServer())
      .post('/api/buildings').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Validation Block' });
    const buildingId = buildingRes.body.id;

    const base = { building_id: buildingId, name: 'Bad Room', type: 'Classroom' };

    // BVA: capacity=0 is just below the @Min(1) boundary
    const zeroRes = await request(app.getHttpServer())
      .post('/api/rooms').set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, capacity: 0 });
    expect(zeroRes.status).toBe(400);

    // BVA: capacity=-1 is further below
    const negRes = await request(app.getHttpServer())
      .post('/api/rooms').set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, capacity: -1 });
    expect(negRes.status).toBe(400);

    // Invalid type: not in ['Classroom', 'Seminar Hall', 'Computer Lab', 'Meeting Room']
    const typeRes = await request(app.getHttpServer())
      .post('/api/rooms').set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, capacity: 30, type: 'Lounge' });
    expect(typeRes.status).toBe(400);
  });

  it('API-ADMIN-006: admin blocks slots; student booking on a blocked slot → 409', async () => {
    const room = seededRooms[0];
    const date = '2027-09-01';

    const blockRes = await request(app.getHttpServer())
      .post('/api/blocked-slots').set('Authorization', `Bearer ${adminToken}`)
      .send({ room_id: room.id, date, slot_ids: [1, 2, 3], reason: 'Event' });

    expect(blockRes.status).toBe(201);
    // POST /api/blocked-slots returns an array — one row per slot_id
    expect(Array.isArray(blockRes.body)).toBe(true);
    expect(blockRes.body).toHaveLength(3);

    // Student tries to book slot 2 on the same date — must be rejected
    const bookRes = await request(app.getHttpServer())
      .post('/api/bookings').set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: room.id, date, slot_id: 2, purpose: 'Study session' });

    expect(bookRes.status).toBe(409);
    expect(bookRes.body.message.toLowerCase()).toContain('blocked');
  });

  it('API-ADMIN-007: admin unblocks a slot; student can then book it', async () => {
    const room = seededRooms[0];
    const date = '2027-09-02';

    // Block slot 4
    const blockRes = await request(app.getHttpServer())
      .post('/api/blocked-slots').set('Authorization', `Bearer ${adminToken}`)
      .send({ room_id: room.id, date, slot_ids: [4], reason: 'Maintenance' });
    expect(blockRes.status).toBe(201);

    // Capture the UUID of the blocked slot row — needed for the DELETE
    const blockedSlotId = blockRes.body[0].id;

    // Student is rejected while the block is active
    const rejectedRes = await request(app.getHttpServer())
      .post('/api/bookings').set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: room.id, date, slot_id: 4, purpose: 'Study session' });
    expect(rejectedRes.status).toBe(409);

    // Admin unblocks by deleting the specific blocked slot row
    const unblockRes = await request(app.getHttpServer())
      .delete(`/api/blocked-slots/${blockedSlotId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(unblockRes.status).toBe(200);

    // Student now succeeds on the same room+date+slot
    const successRes = await request(app.getHttpServer())
      .post('/api/bookings').set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: room.id, date, slot_id: 4, purpose: 'Study session' });
    expect(successRes.status).toBe(201);
    expect(successRes.body.status).toBe('pending');
  });
});

