import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp } from './helpers/setup';
import { resetDatabase, seedTestData, getSupabaseClient } from './helpers/seed';
import { loginAs } from './helpers/auth';

describe('Cancellation API', () => {
  let app: INestApplication;
  let studentToken : string;
  let studentBToken: string;  // Student B — needed for AUTHZ test
  let poToken      : string;
  let poUser  : any;
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
    const po = await loginAs(app, 'po001', 'po123');
    poToken  = po.token;
    poUser   = po.user;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── API-CANCEL-001 ───────────────────────────────────────────────────────
  it('API-CANCEL-001: student cancels own pending booking → status becomes cancelled', async () => {
    const booking = await createBooking(studentToken);

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled'); // Asserts expected behavior per F-010 — will fail until fixed
  });

  // ── API-CANCEL-002a ──────────────────────────────────────────────────────
  it('API-CANCEL-002a: student cancels approved booking → status becomes cancelled', async () => {
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
    expect(cancelRes.body.status).toBe('cancelled'); // Asserts expected behavior per F-010 — will fail until fixed
  });

  // ── API-CANCEL-002b ──────────────────────────────────────────────────────
  it('API-CANCEL-002b: after student cancels approved booking → slot is re-bookable', async () => {
    // Setup: create, approve, cancel
    const booking = await createBooking(studentToken);

    await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/approve`)
      .set('Authorization', `Bearer ${poToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    // Assertion: the slot must now be available for a new booking
    const rebookRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ room_id: rooms[0].id, date: '2026-09-15', slot_id: 2, purpose: 'Re-book' });

    expect(rebookRes.status).toBe(201); // Asserts expected behavior per F-022 — will fail until schema constraint is fixed
  });

  // ── API-CANCEL-003 ───────────────────────────────────────────────────────
  it('API-CANCEL-003: cancel after booking start time → 403', async () => {
    // Note: this test setup relies on F-012 (past dates currently accepted by the API).
    // If F-012 is fixed before F-011, createBooking will throw and this test
    // will fail at setup — that failure should be investigated in that context.
    const booking = await createBooking(studentToken, {
      date    : '2020-01-01',
      slot_id : 1,
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403); // Asserts expected behavior per F-011 — will fail until timing guard is implemented
  });

  // ── API-CANCEL-004 ───────────────────────────────────────────────────────
  it('API-CANCEL-004: cancel before booking start time → 200', async () => {
    // Future booking — cancellation before start time must succeed.
    // Together with CANCEL-003, these form the timing boundary pair.
    const booking = await createBooking(studentToken, { date: '2027-06-01' });

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
  });

  // ── API-CANCEL-AUTHZ ─────────────────────────────────────────────────────
  it('API-CANCEL-AUTHZ: student cannot cancel another student\'s booking → 403', async () => {
    const booking = await createBooking(studentToken);

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('your own');
  });

  // ── API-CANCEL-STATE ─────────────────────────────────────────────────────
  it('API-CANCEL-STATE: cannot cancel an already-cancelled booking → 400', async () => {
    const booking = await createBooking(studentToken);

    // First cancel — must succeed
    const firstCancel = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(firstCancel.status).toBe(200);

    // Second cancel — status is now 'cancelled', not in ['pending','approved']
    const secondCancel = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(secondCancel.status).toBe(400);
    expect(secondCancel.body.message).toContain('pending or approved');
  });

  // ── API-CANCEL-005a ──────────────────────────────────────────────────────
  it('API-CANCEL-005a: PO cancels student approved booking → status becomes cancelled', async () => {
    const booking = await createBooking(studentToken);
    expect(booking.status).toBe('pending');

    const approveRes = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/approve`)
      .set('Authorization', `Bearer ${poToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');

    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${poToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled'); // Asserts expected behavior per F-018 — will fail until fixed

    // DB readback: reviewed_by must be the PO's ID
    const supabase = getSupabaseClient();
    const { data: row } = await supabase
      .from('bookings')
      .select('reviewed_by')
      .eq('id', booking.id)
      .single();

    expect(row.reviewed_by).toBe(poUser.id);
  });

  // ── API-CANCEL-005b ──────────────────────────────────────────────────────
  it('API-CANCEL-005b: after PO cancels student booking → slot is re-bookable by another student', async () => {
    // Setup: create, approve, PO cancels
    const booking = await createBooking(studentToken);

    await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/approve`)
      .set('Authorization', `Bearer ${poToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${poToken}`)
      .expect(200);

    // Assertion: Student B must be able to book the now-freed slot
    const rebookRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentBToken}`)
      .send({
        room_id : rooms[0].id,
        date    : '2026-09-15',
        slot_id : 2,
        purpose : 'Student B re-booking after PO cancel',
      });

    expect(rebookRes.status).toBe(201); // Asserts expected behavior per F-022 — will fail until schema constraint is fixed
  });

  // ── API-CANCEL-PO-AUTH ─────────────────────────────────────────────────────
  it('API-CANCEL-PO-AUTH: PO token can cancel any student booking', async () => {
    // Verifies the role bypass in cancel() — PO is not the booking owner
    // but must not receive the 403 that a student-cancelling-another's-booking would get.
    const booking = await createBooking(studentToken);

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${poToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled'); // Asserts expected behavior per F-010/F-018 — will fail until fixed
  });

});