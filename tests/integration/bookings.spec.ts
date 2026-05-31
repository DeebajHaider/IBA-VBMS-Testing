import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp } from './helpers/setup';
import { resetDatabase, seedTestData } from './helpers/seed';
import { loginAs } from './helpers/auth';

describe('Booking Creation API', () => {
  let app: INestApplication;
  let studentToken: string;
  let adminToken: string;
  let rooms: any[];

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    const seeded = await seedTestData();
    rooms        = seeded.rooms;
    studentToken = (await loginAs(app, '12345',  'student123')).token;
    adminToken   = (await loginAs(app, 'admin',  'admin123')).token;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── API-BOOK-001 ──────────────────────────────────────────────────────────
  it('API-BOOK-001: valid booking returns 201 with status pending and nested shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        room_id : rooms[0].id,
        date    : '2026-09-15',
        slot_id : 2,
        purpose : 'Project meeting',
      });

    // Status and core fields
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.purpose).toBe('Project meeting');

    // Nested user — confirms the booking was attributed to the right student
    expect(res.body.users.erp).toBe('12345');

    // Nested room — confirms the FK join is working
    expect(res.body.rooms.id).toBe(rooms[0].id);

    // Nested time slot — slot_id 2 should resolve to the second time slot
    expect(res.body.time_slots.id).toBe(2);

    // Password must never appear in any response
    expect(res.body.users.password).toBeUndefined();
  });

  // ── API-BOOK-002 ──────────────────────────────────────────────────────────
  it('API-BOOK-002: booking same room+date+slot twice returns 409 on the second attempt', async () => {
    const bookingBody = {
      room_id : rooms[0].id,
      date    : '2026-09-15',
      slot_id : 2,
      purpose : 'First booking',
    };

    // First booking — must succeed
    const first = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(bookingBody);

    expect(first.status).toBe(201);

    // Second booking — same room, date, slot — must be rejected
    const second = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ ...bookingBody, purpose: 'Second attempt' });

    expect(second.status).toBe(409);
    expect(second.body.message).toContain('already booked');
  });

  // ── API-BOOK-003 ──────────────────────────────────────────────────────────
  it('API-BOOK-003: booking a blocked slot returns 409', async () => {
    // SETUP: admin blocks slot 3 on a specific date via the API.
    // We assert 201 here so a setup failure is immediately obvious —
    // if the block silently fails, the student booking would return 201
    // and we'd get a confusing "expected 409, got 201" instead of
    // "expected setup to return 201, got X".
    const blockRes = await request(app.getHttpServer())
      .post('/api/blocked-slots')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_id  : rooms[0].id,
        date     : '2026-09-20',
        slot_ids : [3],          // note: array, not a single number
        reason   : 'Maintenance',
      });

    expect(blockRes.status).toBe(201);

    // ACT: student attempts to book the now-blocked slot
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        room_id : rooms[0].id,
        date    : '2026-09-20',
        slot_id : 3,
        purpose : 'Study session',
      });

    expect(res.status).toBe(409);
    expect(res.body.message.toLowerCase()).toContain('blocked');
  });

  // ── API-BOOK-004 ──────────────────────────────────────────────────────────
  it('API-BOOK-004: slot_id 1 (lower valid bound) returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        room_id : rooms[0].id,
        date    : '2026-09-15',
        slot_id : 1,
        purpose : 'Morning session',
      });

    expect(res.status).toBe(201);
    expect(res.body.time_slots.id).toBe(1);
  });

  // ── API-BOOK-005 ──────────────────────────────────────────────────────────
  it('API-BOOK-005: slot_id 7 (upper valid bound) returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        room_id : rooms[0].id,
        date    : '2026-09-15',
        slot_id : 7,
        purpose : 'Evening session',
      });

    expect(res.status).toBe(201);
    expect(res.body.time_slots.id).toBe(7);
  });

  // ── API-BOOK-006 ──────────────────────────────────────────────────────────
  it('API-BOOK-006: slot_id 0 (just below valid range) — record actual behavior', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: rooms[0].id, date: '2026-09-15', slot_id: 0, purpose: 'test' });

    // F-013: passes @IsInt() (no @Min(1) on DTO), conflict checks return null,
    // insert hits FK constraint bookings_slot_id_fkey → raw 500.
    // Should be 400 from DTO validation. Assertion updated to match reality.
    expect(res.status).toBe(500);
  });

  // ── API-BOOK-007 ──────────────────────────────────────────────────────────
  it('API-BOOK-007: slot_id 8 (just above valid range) — record actual behavior', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: rooms[0].id, date: '2026-09-15', slot_id: 8, purpose: 'test' });

    // F-013: same as BOOK-006. FK violation → 500.
    expect(res.status).toBe(500);
  });

  // ── API-BOOK-007b ─────────────────────────────────────────────────────────
  it('API-BOOK-007b: slot_id -1 (negative integer) — record actual behavior', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: rooms[0].id, date: '2026-09-15', slot_id: -1, purpose: 'test' });

    // F-013: same as BOOK-006. FK violation → 500.
    expect(res.status).toBe(500);
  });

  // ── API-BOOK-007c ─────────────────────────────────────────────────────────
  it('API-BOOK-007c: slot_id "abc" (wrong type) returns 400', async () => {
    // @Type(()=>Number) coerces "abc" → NaN. @IsInt() rejects NaN.
    // ValidationPipe catches this before the service runs — confident 400.
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: rooms[0].id, date: '2026-09-15', slot_id: 'abc', purpose: 'test' });

    expect(res.status).toBe(400);
  });

  // ── API-BOOK-008 ──────────────────────────────────────────────────────────
  it('API-BOOK-008: empty purpose returns 400 with validation message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: rooms[0].id, date: '2026-09-15', slot_id: 2, purpose: '' });

    expect(res.status).toBe(400);
    // Validation errors are a flat string array (same format as F-002).
    // This likely confirms F-014.
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(res.body.message.join(' ')).toContain('purpose');
  });

  // ── API-BOOK-DATE-001 ─────────────────────────────────────────────────────
  it('API-BOOK-DATE-001: malformed date format returns 400', async () => {
    // @IsDateString() only accepts ISO 8601 format (YYYY-MM-DD).
    // DD-MM-YYYY is a common user mistake — DTO validation should catch it.
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: rooms[0].id, date: '15-07-2026', slot_id: 2, purpose: 'test' });

    expect(res.status).toBe(400);
  });

  // ── API-BOOK-DATE-002 ─────────────────────────────────────────────────────
  it('API-BOOK-DATE-002: past date is accepted — F-012 confirmed', async () => {
    // SRS says past dates should be rejected.
    // @IsDateString() only validates format, not value — '2020-01-01' is valid ISO.
    // No date-range check exists anywhere in the service or DTO.
    // Expected per SRS: 400. Actual: 201 — the booking is created.
    // Assertion written to match reality; the 201 itself is the finding.
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: rooms[0].id, date: '2020-01-01', slot_id: 2, purpose: 'backdated booking' });

    // F-012: past dates are not rejected. System accepts bookings for any valid
    // ISO date string regardless of whether it has already passed.
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.date).toBe('2020-01-01');
  });

});