import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp } from './helpers/setup';
import { resetDatabase, seedTestData, getSupabaseClient } from './helpers/seed';
import { loginAs } from './helpers/auth';

describe('PO Booking Management API', () => {
  let app: INestApplication;
  let studentToken:  string;
  let studentBToken: string;
  let poToken:       string;
  let poUser:        any;
  let rooms:         any[];

  // Local helper — same pattern as cancel.spec.ts.
  // Closes over `app` and `rooms`. Throws immediately on non-201 so a
  // broken setup step fails loudly rather than producing a confusing
  // assertion error further down the test.
  async function createBooking(token: string, overrides: object = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        room_id : rooms[0].id,
        date    : '2026-11-10',
        slot_id : 2,
        purpose : 'PO test booking',
        ...overrides,
      });
    if (res.status !== 201) throw new Error(`createBooking failed with ${res.status}: ${JSON.stringify(res.body)}`);
    return res.body;
  }

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    const seeded  = await seedTestData();
    rooms         = seeded.rooms;
    studentToken  = (await loginAs(app, '12345', 'student123')).token;
    studentBToken = (await loginAs(app, '67890', 'student123')).token;
    // loginAs returns both token and user — we need poUser.id for DB assertions
    const po      = await loginAs(app, 'po001', 'po123');
    poToken       = po.token;
    poUser        = po.user;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── API-PO-001 ─────────────────────────────────────────────────────────────
  it('API-PO-001: GET /api/bookings?status=pending returns only pending bookings', async () => {
    // SETUP: create 3 bookings with 3 different statuses.
    // We create all three as pending via the API, then use approve/reject
    // to set the other two statuses. This avoids direct DB writes.
    const bookingA = await createBooking(studentToken,  { slot_id: 1, purpose: 'Will stay pending' });
    const bookingB = await createBooking(studentToken,  { slot_id: 3, purpose: 'Will be approved' });
    const bookingC = await createBooking(studentBToken, { slot_id: 4, purpose: 'Will be rejected' });

    // Move B to approved and C to rejected so we have one of each status
    await request(app.getHttpServer())
      .patch(`/api/bookings/${bookingB.id}/approve`)
      .set('Authorization', `Bearer ${poToken}`);

    await request(app.getHttpServer())
      .patch(`/api/bookings/${bookingC.id}/reject`)
      .set('Authorization', `Bearer ${poToken}`);

    // ACT: PO fetches only pending bookings
    const res = await request(app.getHttpServer())
      .get('/api/bookings?status=pending')
      .set('Authorization', `Bearer ${poToken}`);

    expect(res.status).toBe(200);
    // Filter must work: exactly 1 pending booking exists, not 3
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(bookingA.id);
    expect(res.body[0].status).toBe('pending');
  });

  // ── API-PO-002 ─────────────────────────────────────────────────────────────
  it('API-PO-002: PO approves a booking — status becomes approved, reviewed_by set in DB', async () => {
    const booking = await createBooking(studentToken);

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/approve`)
      .set('Authorization', `Bearer ${poToken}`);

    // HTTP response confirms status change
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    // DB readback confirms reviewed_by — the response body doesn't expose this
    // field at the top level, so we go directly to the database.
    // This is the audit trail check: we need to know *who* approved it, not just
    // that it was approved.
    const supabase = getSupabaseClient();
    const { data: row } = await supabase
      .from('bookings')
      .select('reviewed_by')
      .eq('id', booking.id)
      .single();

    expect(row.reviewed_by).toBe(poUser.id);
  });

  // ── API-PO-003 ─────────────────────────────────────────────────────────────
  it('API-PO-003: PO rejects a booking — status becomes rejected, slot re-bookable by another student', async () => {
    // Student A books slot 2 on 2026-11-10
    const booking = await createBooking(studentToken);

    // PO rejects it
    const rejectRes = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/reject`)
      .set('Authorization', `Bearer ${poToken}`);

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('rejected');

    // Student B now tries to book the exact same room+date+slot.
    // The conflict check in create() filters on status IN ('pending','approved').
    // A 'rejected' row does not block re-booking — this assertion proves that.
    const rebookRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentBToken}`)
      .send({
        room_id : rooms[0].id,
        date    : '2026-11-10',
        slot_id : 2,
        purpose : 'Student B re-booking after rejection',
      });

    expect(rebookRes.status).toBe(201);
    expect(rebookRes.body.status).toBe('pending');
  });

  // ── API-PO-AUTH-001 ────────────────────────────────────────────────────────
  it('API-PO-AUTH-001: student token cannot approve a booking — 403', async () => {
    // Create a real pending booking so the 403 is clearly from the role guard,
    // not from a missing resource. If we used a fake ID and got 403, we couldn't
    // be sure whether the guard or a not-found check fired first.
    const booking = await createBooking(studentToken);

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/approve`)
      .set('Authorization', `Bearer ${studentToken}`);

    // The RolesGuard runs before the service. A student never reaches updateStatus().
    expect(res.status).toBe(403);
  });

  // ── API-PO-AUTH-002 ────────────────────────────────────────────────────────
  it('API-PO-AUTH-002: student token cannot reject a booking — 403', async () => {
    // Same rationale as AUTH-001: real booking, student token, different endpoint.
    // Both /approve and /reject have @Roles('admin','programoffice') — testing
    // both ensures neither decorator was accidentally removed.
    const booking = await createBooking(studentToken);

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/reject`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  // ── API-PO-NOTFOUND-001 ────────────────────────────────────────────────────
  it('API-PO-NOTFOUND-001: approve a non-existent booking ID returns 404', async () => {
    // A well-formed UUID that simply doesn't exist in the database.
    // Using a valid UUID format is important: an invalid format (e.g. "abc") might
    // be caught by a route param pipe and return 400 for the wrong reason.
    // We want to test the not-found path in updateStatus(), not the router.
    const nonExistentId = '00000000-0000-0000-0000-000000000099';

    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${nonExistentId}/approve`)
      .set('Authorization', `Bearer ${poToken}`);

    expect(res.status).toBe(404);
  });

});

