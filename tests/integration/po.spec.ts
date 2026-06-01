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

    // F-022: same root cause as API-CANCEL-002.
    // PO cancellation frees the slot at the application layer (status → 'rejected')
    // but the DB unique constraint still holds the row, blocking re-insertion.
    expect(rebookRes.status).toBe(500); // F-022
    // Cannot assert 'pending' — the booking was never created
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

  // ── API-PO-STATE-001 ───────────────────────────────────────────────────────
  it('API-PO-STATE-001: approve an already-rejected booking', async () => {
    // SETUP: create a booking, then reject it
    const booking = await createBooking(studentToken);

    await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/reject`)
      .set('Authorization', `Bearer ${poToken}`);

    // ACT: attempt to approve it now that it is 'rejected'
    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/approve`)
      .set('Authorization', `Bearer ${poToken}`);

    // The SRS implies illegal transitions should be blocked (a rejected booking
    // should not be approvable), but the service does a blind UPDATE.
    // This assertion is written to match reality — 200, not 400.
    // The test passing is itself the finding.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved'); // transition silently succeeded
  });

  // ── API-PO-STATE-002 ───────────────────────────────────────────────────────
  it('API-PO-STATE-002: reject an already-approved booking', async () => {
    // SETUP: create a booking, then approve it
    const booking = await createBooking(studentToken);

    await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/approve`)
      .set('Authorization', `Bearer ${poToken}`);

    // ACT: attempt to reject it now that it is 'approved'
    const res = await request(app.getHttpServer())
      .patch(`/api/bookings/${booking.id}/reject`)
      .set('Authorization', `Bearer ${poToken}`);

    // F-020: same root cause as STATE-001.
    // An approved booking should not be directly rejectable via /reject —
    // the cancel endpoint exists for that purpose. But no guard prevents it.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected'); // transition silently succeeded
  });

  // ── API-PO-004 ─────────────────────────────────────────────────────────────
  it('API-PO-004: two pending bookings for the same slot', async () => {
    // WHY DIRECT INSERT:
    // The create() endpoint prevents two pending bookings for the same slot
    // via a conflict check. TC-PO-004 describes approving one of two competing
    // pending bookings — but this scenario is unreachable through the normal API.
    // We use getSupabaseClient() to bypass the conflict check entirely.
    const supabase = getSupabaseClient();

    // We need the real user UUIDs — seedTestData() returns them.
    // loginAs() only returns the token and the JWT payload, not the full DB row.
    // So we fetch the users directly here.
    const { data: users } = await supabase
      .from('users')
      .select('id, erp')
      .in('erp', ['12345', '67890']);

    const studentAId = users.find((u: any) => u.erp === '12345').id;
    const studentBId = users.find((u: any) => u.erp === '67890').id;

    // Attempt to insert two pending bookings for the exact same room+date+slot.
    // The bookings table has a UNIQUE constraint on (room_id, date, slot_id).
    // The first insert will succeed. The second will fail with a constraint violation.
    const insertA = await supabase.from('bookings').insert({
      user_id : studentAId,
      room_id : rooms[0].id,
      date    : '2026-12-01',
      slot_id : 5,
      purpose : 'TC-PO-004 Booking A',
      status  : 'pending',
    }).select().single();

    const insertB = await supabase.from('bookings').insert({
      user_id : studentBId,
      room_id : rooms[0].id,
      date    : '2026-12-01',
      slot_id : 5,
      purpose : 'TC-PO-004 Booking B',
      status  : 'pending',
    }).select().single();

    // the unique constraint on (room_id, date, slot_id) prevents even a
    // direct DB insert of two pending bookings for the same slot.
    // TC-PO-004 describes a scenario that is impossible at the database level,
    // not just at the API level. The test plan describes behaviour that requires
    // a constraint change to even reproduce. Document and proceed.
    if (insertB.error) {
      // Expected path — constraint blocked the second insert.
      // This is F-019: the test plan scenario is unreachable even via direct DB insert.
      expect(insertB.error.code).toBe('23505'); // PostgreSQL unique violation code
      console.warn(
        'F-019: TC-PO-004 scenario is unreachable — DB unique constraint on ' +
        '(room_id, date, slot_id) prevents two pending bookings for the same slot ' +
        'even via direct insert. Test plan describes an impossible state.'
      );
      return; // Finding documented, test concludes
    }

    // If we somehow got here (constraint doesn't exist or was removed),
    // test what happens when PO approves Booking A.
    const bookingAId = insertA.data.id;
    const bookingBId = insertB.data.id;

    const approveRes = await request(app.getHttpServer())
      .patch(`/api/bookings/${bookingAId}/approve`)
      .set('Authorization', `Bearer ${poToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');

    // Check whether Booking B was auto-handled
    const { data: bookingB } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', bookingBId)
      .single();

    // F-016 would apply here: no auto-rejection of Booking B.
    // If execution reaches this point, document whatever status Booking B has.
    console.warn(`Booking B status after A approved: ${bookingB.status}`);
    expect(bookingB.status).toBe('pending'); // service has no auto-rejection logic
  });

});

