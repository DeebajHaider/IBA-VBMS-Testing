import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp } from './helpers/setup';
import { resetDatabase, seedTestData } from './helpers/seed';
import { loginAs } from './helpers/auth';

describe('Cancellation API', () => {
  let app: INestApplication;
  let studentToken : string;
  let studentBToken: string;  // Student B — needed for AUTHZ test
  let poToken      : string;
  let rooms        : any[];

  // ── helper ──────────────────────────────────────────────────────────────
  async function createBooking(token: string, overrides: object = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        room_id : rooms[0].id,
        date    : '2026-09-15',
        slot_id : 2,
        purpose : 'Test booking',
        ...overrides,
      });
    if (res.status !== 201) {
      throw new Error(`createBooking setup failed: ${res.status} — ${JSON.stringify(res.body)}`);
    }
    return res.body;
  }

  // ── lifecycle ────────────────────────────────────────────────────────────
  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    const seeded  = await seedTestData();
    rooms         = seeded.rooms;
    studentToken  = (await loginAs(app, '12345', 'student123')).token;
    studentBToken = (await loginAs(app, '67890', 'student123')).token;
    poToken       = (await loginAs(app, 'po001', 'po123')).token;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── API-CANCEL-001 ───────────────────────────────────────────────────────
  it('API-CANCEL-001: student cancels own pending booking — status becomes rejected (F-010)', async () => {
    const booking = await createBooking(studentToken);

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected'); // F-010: cancel → 'rejected', not 'cancelled'
  });

  // ── API-CANCEL-002 ───────────────────────────────────────────────────────
  it('API-CANCEL-002: student cancels approved booking — slot becomes re-bookable', async () => {
    const booking = await createBooking(studentToken);

    const approveRes = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/approve`)
      .set('Authorization', `Bearer ${poToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');

    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('rejected');

    const rebookRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: rooms[0].id, date: '2026-09-15', slot_id: 2, purpose: 'Re-book' });
    expect(rebookRes.status).toBe(201);
  });

  // ── API-CANCEL-003 ───────────────────────────────────────────────────────
  it('API-CANCEL-003: cancel after booking start time succeeds — timing not enforced (F-011)', async () => {
    // Past-date booking works because of F-012 (no date-range validation).
    // Slot 1 = 8:30 AM on 2020-01-01 — this start time is years in the past.
    // Test plan says cancel should be blocked after start. Code has no such check.
    const booking = await createBooking(studentToken, {
      date    : '2020-01-01',
      slot_id : 1,
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    // F-011: cancel() contains no timing logic. Returns 200 regardless of
    // whether the booking's start time has already passed.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });

  // ── API-CANCEL-004 ───────────────────────────────────────────────────────
  it('API-CANCEL-004: cancel before booking start time returns 200', async () => {
    // Future booking — we are before the start time. Expected and actual: 200.
    // Together with CANCEL-003, these confirm the code is entirely
    // indifferent to timing in either direction.
    const booking = await createBooking(studentToken, { date: '2027-06-01' });

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
  });

  // ── API-CANCEL-AUTHZ ─────────────────────────────────────────────────────
  it('API-CANCEL-AUTHZ: student cannot cancel another student\'s booking → 403', async () => {
    // Student A (12345) creates the booking
    const booking = await createBooking(studentToken);

    // Student B (67890) tries to cancel it
    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('your own');
  });

  // ── API-CANCEL-STATE ─────────────────────────────────────────────────────
  it('API-CANCEL-STATE: cannot cancel an already-rejected booking → 400', async () => {
    const booking = await createBooking(studentToken);

    // First cancel — succeeds, status becomes 'rejected'
    const firstCancel = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(firstCancel.status).toBe(200);

    // Second cancel — status is now 'rejected', not in ['pending','approved']
    const secondCancel = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(secondCancel.status).toBe(400);
    expect(secondCancel.body.message).toContain('pending or approved');
  });

}); 