import 'reflect-metadata';
import { ConflictException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingsService } from '../../iba-backend/src/bookings/bookings.service';

// ── shared test data ────────────────────────────────────────────────────────
const ROOM_ID    = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID    = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OTHER_ID   = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const BOOKING_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const ADMIN_ID   = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const PO_ID      = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const VALID_DTO = {
  room_id : ROOM_ID,
  date    : '2026-07-01',
  slot_id : 3,
  purpose : 'Project meeting',
};

// A minimal booking row as findOne() would return it.
// Note: the service reads booking.users?.id (nested JOIN), not booking.user_id.
// We must match that shape exactly or the ownership check silently misbehaves.
const PENDING_BOOKING = {
  id     : BOOKING_ID,
  status : 'pending',
  users  : { id: USER_ID, erp: '12345', name: 'Student A', email: 'a@test.iba' },
  rooms  : { id: ROOM_ID, name: 'Room 101', buildings: { id: 'bid', name: 'Test Block' } },
  time_slots: { id: 3, start_time: '11:30', end_time: '12:45', label: '11:30 – 12:45' },
};

// ── describe block ───────────────────────────────────────────────────────────
describe('BookingsService', () => {
  let service: BookingsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      from        : jest.fn().mockReturnThis(),
      select      : jest.fn().mockReturnThis(),
      eq          : jest.fn().mockReturnThis(),
      in          : jest.fn().mockReturnThis(),
      insert      : jest.fn().mockReturnThis(),
      update      : jest.fn().mockReturnThis(),
      order       : jest.fn().mockReturnThis(),
      single      : jest.fn(),
      maybeSingle : jest.fn(),
    };

    service = new BookingsService({ db: mockDb } as any);
  });

  // ── UT-005 ─────────────────────────────────────────────────────────────────
  describe('UT-005: create() — blocked slot', () => {
    it('throws ConflictException and never inserts when the slot is blocked', async () => {
      mockDb.single.mockResolvedValueOnce({ data: { id: 'block-uuid-001' }, error: null });

      await expect(service.create(USER_ID, VALID_DTO))
        .rejects.toThrow(ConflictException);

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('ConflictException message says "blocked by admin"', async () => {
      mockDb.single.mockResolvedValueOnce({ data: { id: 'block-uuid-001' }, error: null });

      await expect(service.create(USER_ID, VALID_DTO))
        .rejects.toThrow(/blocked by admin/i);
    });
  });

  // ── UT-006 ─────────────────────────────────────────────────────────────────
  describe('UT-006: create() — booking conflict', () => {
    it('throws ConflictException and never inserts when a pending/approved booking exists', async () => {
      mockDb.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'existing-booking' }, error: null });

      await expect(service.create(USER_ID, VALID_DTO))
        .rejects.toThrow(ConflictException);

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('ConflictException message says "already booked"', async () => {
      mockDb.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'existing-booking' }, error: null });

      await expect(service.create(USER_ID, VALID_DTO))
        .rejects.toThrow(/already booked/i);
    });
  });

  // ── UT-007 ─────────────────────────────────────────────────────────────────
  describe('UT-007: create() — happy path', () => {
    it('calls insert with the correct payload including status: "pending"', async () => {
      // ARRANGE: clear both conflict checks, then return a fake row from insert
      mockDb.single
        .mockResolvedValueOnce({ data: null, error: null })          // blocked check → clear
        .mockResolvedValueOnce({ data: null, error: null })          // conflict check → clear
        .mockResolvedValueOnce({ data: PENDING_BOOKING, error: null }); // insert result

      // ACT
      const result = await service.create(USER_ID, VALID_DTO);

      // ASSERT: insert was called with the right shape
      // expect.objectContaining() checks a subset — we care about these specific
      // fields, not the full object. status: 'pending' is the critical one because
      // the service hardcodes it; the caller never passes a status.
      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id : USER_ID,
          room_id : ROOM_ID,
          date    : '2026-07-01',
          slot_id : 3,
          purpose : 'Project meeting',
          status  : 'pending',    // ← hardcoded by service, never from caller
        })
      );

      // ASSERT: the returned value is whatever the DB gives back
      expect(result).toEqual(PENDING_BOOKING);
    });
  });

  // ── UT-008 ─────────────────────────────────────────────────────────────────
  describe('UT-008: cancel() — student cannot cancel another student\'s booking', () => {
    it('throws ForbiddenException when student tries to cancel a booking they do not own', async () => {
      // ARRANGE: findOne() calls single() internally — return a booking owned by USER_ID
      // OTHER_ID is the one calling cancel, so ownership check should fire
      mockDb.single.mockResolvedValueOnce({ data: PENDING_BOOKING, error: null });

      // ACT + ASSERT
      // Real signature: cancel(id, requesterId, requesterRole)
      // OTHER_ID is trying to cancel USER_ID's booking
      await expect(service.cancel(BOOKING_ID, OTHER_ID, 'student'))
        .rejects.toThrow(ForbiddenException);
    });

    it('ForbiddenException message mentions own bookings', async () => {
      mockDb.single.mockResolvedValueOnce({ data: PENDING_BOOKING, error: null });

      await expect(service.cancel(BOOKING_ID, OTHER_ID, 'student'))
        .rejects.toThrow(/your own bookings/i);
    });
  });

  // ── UT-009 ─────────────────────────────────────────────────────────────────
  describe('UT-009: cancel() — admin can cancel any booking', () => {
    it('does not throw and fires the update when an admin cancels a booking they do not own', async () => {
      // cancel() calls findOne() first → single() #1
      // then calls updateStatus() internally → single() #2
      // Queue both in execution order.
      mockDb.single
        .mockResolvedValueOnce({ data: PENDING_BOOKING, error: null })
        .mockResolvedValueOnce({
          data: { ...PENDING_BOOKING, status: 'rejected', reviewed_by: ADMIN_ID },
          error: null,
        });

      // ADMIN_ID does not own the booking (USER_ID does) — ownership check must be skipped
      const result = await service.cancel(BOOKING_ID, ADMIN_ID, 'admin');

      // The update must have fired with 'rejected' and the admin's ID as reviewer.
      // This is the proof that the method didn't bail out early.
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rejected', reviewed_by: ADMIN_ID })
      );
      expect(result.status).toBe('rejected');
    });
  });

  // ── UT-010 ─────────────────────────────────────────────────────────────────
  describe('UT-010: cancel() — cannot cancel an already-rejected booking', () => {
    it('throws BadRequestException when booking status is already "rejected"', async () => {
      // ARRANGE: same booking but status is 'rejected' — USER_ID cancels their own
      // so ownership check passes, but the status check fires next
      const rejectedBooking = { ...PENDING_BOOKING, status: 'rejected' };
      mockDb.single.mockResolvedValueOnce({ data: rejectedBooking, error: null });

      // USER_ID cancels their own booking — auth is fine, state is not
      await expect(service.cancel(BOOKING_ID, USER_ID, 'student'))
        .rejects.toThrow(BadRequestException);
    });

    it('BadRequestException message mentions pending or approved', async () => {
      const rejectedBooking = { ...PENDING_BOOKING, status: 'rejected' };
      mockDb.single.mockResolvedValueOnce({ data: rejectedBooking, error: null });

      await expect(service.cancel(BOOKING_ID, USER_ID, 'student'))
        .rejects.toThrow(/pending or approved/i);
    });
  });

  // ── UT-014 ─────────────────────────────────────────────────────────────────
  describe('UT-014: updateStatus() — happy path', () => {
    it('writes both status and reviewed_by, and returns the updated booking', async () => {
      // updateStatus() goes straight to update() — no findOne() first.
      // Only one single() fires: the one at the end of the update chain.
      const approvedRow = { ...PENDING_BOOKING, status: 'approved', reviewed_by: PO_ID };
      mockDb.single.mockResolvedValueOnce({ data: approvedRow, error: null });

      const result = await service.updateStatus(BOOKING_ID, 'approved', PO_ID);

      // reviewed_by is the audit trail — asserting it specifically is the point of this test.
      // If it ever stops being written, this assertion catches it.
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', reviewed_by: PO_ID })
      );
      expect(result.status).toBe('approved');
      expect((result as any).reviewed_by).toBe(PO_ID);
    });

    it('works identically for status: "rejected"', async () => {
      // updateStatus() is status-agnostic — same code path for approve and reject.
      // A second assertion with 'rejected' confirms the method is not hardcoded to 'approved'.
      const rejectedRow = { ...PENDING_BOOKING, status: 'rejected', reviewed_by: PO_ID };
      mockDb.single.mockResolvedValueOnce({ data: rejectedRow, error: null });

      const result = await service.updateStatus(BOOKING_ID, 'rejected', PO_ID);

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rejected', reviewed_by: PO_ID })
      );
      expect(result.status).toBe('rejected');
    });
  });

  // ── UT-015 ─────────────────────────────────────────────────────────────────
  describe('UT-015: updateStatus() — booking not found', () => {
    it('throws NotFoundException when Supabase returns null data', async () => {
      // The service guard is: if (error || !data) throw new NotFoundException(...)
      // We test the !data branch — this is what a missing row looks like from Supabase.
      mockDb.single.mockResolvedValueOnce({ data: null, error: null });

      await expect(service.updateStatus(BOOKING_ID, 'approved', PO_ID))
        .rejects.toThrow(NotFoundException);
    });

    it('still calls update before discovering the row is missing', async () => {
      // Unlike cancel(), updateStatus() does NOT call findOne() first.
      // It fires the update and then inspects the result.
      // This means mockDb.update IS called even when the row doesn't exist.
      // This test documents that behaviour explicitly.
      mockDb.single.mockResolvedValueOnce({ data: null, error: null });

      await expect(service.updateStatus(BOOKING_ID, 'approved', PO_ID))
        .rejects.toThrow(NotFoundException);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

});