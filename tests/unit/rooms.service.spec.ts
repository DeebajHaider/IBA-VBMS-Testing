import 'reflect-metadata';
import { RoomsService } from '../../iba-backend/src/rooms/rooms.service';

// ── helper ───────────────────────────────────────────────────────────────────
// Builds a self-contained chain mock where every method returns itself.
// Because Promise.all resolves non-Promises immediately, the chain object
// itself lands in the destructured result. Setting .data on it means
// `const { data: bookings } = chainObject` gives us exactly what we want.
function makeListChain(data: any) {
  const mock: any = {
    data,
    error: null,
    select: jest.fn(),
    eq    : jest.fn(),
    in    : jest.fn(),
  };
  mock.select.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);
  mock.in.mockReturnValue(mock);
  return mock;
}

// ── describe block ───────────────────────────────────────────────────────────
describe('RoomsService', () => {
  let service: RoomsService;
  let mockDb: any;

  beforeEach(() => {
    // Base mock — used by tests other than getAvailability if we add them later.
    // from() starts as mockReturnThis; UT-013 overrides it with mockImplementation.
    mockDb = {
      from  : jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq    : jest.fn().mockReturnThis(),
      in    : jest.fn().mockReturnThis(),
      order : jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    service = new RoomsService({ db: mockDb } as any);
  });

  // ── UT-013 ─────────────────────────────────────────────────────────────────
  describe('UT-013: getAvailability() — parallel queries', () => {

    it('returns bookedSlots and blockedSlots populated from their respective queries', async () => {
      // ARRANGE
      const bookedSlotsData = [
        { slot_id: 2, status: 'pending'  },
        { slot_id: 5, status: 'approved' },
      ];
      const blockedSlotsData = [
        { slot_id: 4, reason: 'Maintenance' },
      ];

      // Route from() to independent chain mocks by table name.
      // The bookings chain ends with .in() — that call returns bookingsMock,
      // whose .data is bookedSlotsData.
      // The blocked_slots chain ends with .eq() — same idea.
      const bookingsMock = makeListChain(bookedSlotsData);
      const blockedMock  = makeListChain(blockedSlotsData);

      mockDb.from.mockImplementation((table: string) => {
        if (table === 'bookings')      return bookingsMock;
        if (table === 'blocked_slots') return blockedMock;
        return mockDb; // fallback for any other table
      });

      // ACT
      const result = await service.getAvailability('room-uuid-aaa', '2026-07-01');

      // ASSERT
      expect(result.bookedSlots).toEqual(bookedSlotsData);
      expect(result.blockedSlots).toEqual(blockedSlotsData);
    });

    it('returns empty arrays when data is null (the || [] fallback)', async () => {
      // The service does: bookedSlots: bookings || []
      // This test confirms the fallback fires when Supabase returns null rows.
      mockDb.from.mockImplementation((table: string) => {
        if (table === 'bookings')      return makeListChain(null);
        if (table === 'blocked_slots') return makeListChain(null);
        return mockDb;
      });

      const result = await service.getAvailability('room-uuid-aaa', '2026-07-15');

      expect(result.bookedSlots).toEqual([]);
      expect(result.blockedSlots).toEqual([]);
    });

  });

});
