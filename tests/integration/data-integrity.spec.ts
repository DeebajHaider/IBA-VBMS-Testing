import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp } from './helpers/setup';
import { resetDatabase, seedTestData, getSupabaseClient } from './helpers/seed';
import { loginAs } from './helpers/auth';

describe('Data Integrity', () => {
  let app: INestApplication;
  let studentToken: string;
  let studentUser:  any;
  let poToken:      string;
  let poUser:       any;
  let rooms:        any[];

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    const seeded  = await seedTestData();
    rooms         = seeded.rooms;
    const student = await loginAs(app, '12345', 'student123');
    studentToken  = student.token;
    studentUser   = student.user;
    const po      = await loginAs(app, 'po001', 'po123');
    poToken       = po.token;
    poUser        = po.user;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── API-DATA-001 ───────────────────────────────────────────────────────────
  it('API-DATA-001: booking lifecycle — reviewed_by and updated_at reflect each state change', async () => {
    const supabase = getSupabaseClient();

    // ── STEP 1: Create booking ───────────────────────────────────────────────
    const createRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        room_id : rooms[0].id,
        date    : '2026-11-20',
        slot_id : 3,
        purpose : 'Data integrity lifecycle test',
      });

    expect(createRes.status).toBe(201);
    const bookingId   = createRes.body.id;
    const createdAt   = createRes.body.created_at;

    // DB check after creation: reviewed_by should be null — nobody has acted yet
    const { data: afterCreate } = await supabase
      .from('bookings')
      .select('status, reviewed_by, created_at, updated_at')
      .eq('id', bookingId)
      .single();

    expect(afterCreate.status).toBe('pending');
    expect(afterCreate.reviewed_by).toBeNull();
    // updated_at starts equal to created_at on a fresh insert
    expect(afterCreate.updated_at).toBe(afterCreate.created_at);

    // ── STEP 2: PO approves ──────────────────────────────────────────────────
    // Small delay to ensure updated_at will differ from created_at.
    // The DB trigger fires on UPDATE, but if both happen in the same millisecond
    // the timestamps would be equal. In practice the test round-trip is long
    // enough, but explicit sleep makes the intent clear.
    await new Promise(r => setTimeout(r, 1000));

    const approveRes = await request(app.getHttpServer())
      .patch(`/api/bookings/${bookingId}/approve`)
      .set('Authorization', `Bearer ${poToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');

    const { data: afterApprove } = await supabase
      .from('bookings')
      .select('status, reviewed_by, updated_at')
      .eq('id', bookingId)
      .single();

    // reviewed_by must now be the PO's ID — this is the audit trail
    expect(afterApprove.status).toBe('approved');
    expect(afterApprove.reviewed_by).toBe(poUser.id);
    // updated_at must have advanced — the DB trigger fired on the UPDATE
    expect(new Date(afterApprove.updated_at) > new Date(createdAt)).toBe(true);

    const updatedAfterApprove = afterApprove.updated_at;

    // ── STEP 3: Student cancels ──────────────────────────────────────────────
    await new Promise(r => setTimeout(r, 1000));

    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(cancelRes.status).toBe(200);

    const { data: afterCancel } = await supabase
      .from('bookings')
      .select('status, reviewed_by, updated_at')
      .eq('id', bookingId)
      .single();

    // F-018: cancel writes 'rejected', not 'cancelled'.
    // The status after a student cancellation is indistinguishable from a PO rejection.
    expect(afterCancel.status).toBe('rejected');

    // reviewed_by is now the student's ID — cancel() calls updateStatus(id, 'rejected', requesterId)
    // This means reviewed_by no longer tells you who the *reviewer* was — it was overwritten
    // by the student. The PO's approval is gone from the record.
    expect(afterCancel.reviewed_by).toBe(studentUser.id);

    // updated_at advanced again
    expect(new Date(afterCancel.updated_at) > new Date(updatedAfterApprove)).toBe(true);

    // ── FINDING NOTE ─────────────────────────────────────────────────────────
    // No event log table exists. Only the latest state is stored.
    // The full lifecycle (created → approved → cancelled) cannot be reconstructed
    // from the database — only the final state ('rejected', reviewed_by = student)
    // is visible. The PO approval and who approved it are permanently overwritten.
    // TC-DATA-001 requires "an accurate audit trail of these status changes" —
    // this requirement is not met by the current schema.
    console.warn(
      'F-021: No event log table. Booking history is not preserved. ' +
      'Only final state is stored. TC-DATA-001 audit trail requirement not met.'
    );
  });
});
