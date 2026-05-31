import { ConflictException } from '@nestjs/common';
import { UsersService } from '../../iba-backend/src/users/users.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockDb: any;
  let mockAuthService: any;

  // A minimal valid DTO — the shape UsersService.create() expects
  const validDto = {
    erp:      'new001',
    name:     'New Student',
    email:    'new@iba.edu.pk',
    password: 'plaintext-password',
    role:     'student',
  };

  beforeEach(() => {
    // The insert chain is longer than the login chain:
    // .from('users').insert(data).select().single()
    // So insert() must also return `this`, and we need .select in the mock.
    mockDb = {
      from:        jest.fn().mockReturnThis(),
      select:      jest.fn().mockReturnThis(),
      eq:          jest.fn().mockReturnThis(),
      single:      jest.fn(),
      maybeSingle: jest.fn(),
      insert:      jest.fn().mockReturnThis(),
    };

    // AuthService mock: hashPassword() just slaps a prefix on the string.
    // We don't need real bcrypt here — we just need to verify it WAS called
    // and that its return value (not the original plaintext) reached the DB.
    mockAuthService = {
      hashPassword: jest.fn().mockResolvedValue('HASHED:plaintext-password'),
    };

    // UsersService takes (SupabaseService, AuthService) — both are mocked.
    service = new UsersService(
      { db: mockDb } as any,
      mockAuthService as any,
    );
  });

  // ── UT-011 ───────────────────────────────────────────────────────────────
  describe('UT-011: create — password is hashed before insert', () => {
    it('inserts a hashed password, never the plain-text original', async () => {
      // Arrange ---------------------------------------------------------------
      // First DB call: ERP uniqueness check — returns no existing user.
      // Second DB call: the actual insert — returns the created row.
      // We use mockResolvedValueOnce so the FIRST call to single() gets null
      // (uniqueness check passes) and the SECOND call gets the created user.
      mockDb.single
        .mockResolvedValueOnce({ data: null,  error: null })  // ERP check: not found → OK
        .mockResolvedValueOnce({               // insert result
          data: {
            id:    'new-uuid',
            erp:   'new001',
            name:  'New Student',
            email: 'new@iba.edu.pk',
            role:  'student',
          },
          error: null,
        });

      // Act -------------------------------------------------------------------
      await service.create(validDto as any);

      // Assert ----------------------------------------------------------------
      // 1. hashPassword was called with the original plain-text
      expect(mockAuthService.hashPassword).toHaveBeenCalledWith('plaintext-password');

      // 2. Capture what was actually passed to insert()
      const insertedData = mockDb.insert.mock.calls[0][0];

      // 3. The stored password must be the HASHED value, not the plain-text
      expect(insertedData.password).toBe('HASHED:plaintext-password');
      expect(insertedData.password).not.toBe('plaintext-password');
    });
  });

  // ── UT-012 ───────────────────────────────────────────────────────────────
  describe('UT-012: create — duplicate ERP throws ConflictException', () => {
    it('throws ConflictException and never calls insert when ERP already exists', async () => {
      // Arrange ---------------------------------------------------------------
      // ERP uniqueness check finds an existing user — duplicate detected.
      mockDb.single.mockResolvedValueOnce({
        data: { id: 'existing-uuid' },   // a row exists with this ERP
        error: null,
      });

      // Act + Assert ----------------------------------------------------------
      await expect(
        service.create(validDto as any)
      ).rejects.toThrow(ConflictException);

      // The critical negative assertion: insert must NOT have been called.
      // If this fails, it means the code wrote a duplicate record to the DB
      // despite detecting the conflict — a serious data integrity bug.
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});
