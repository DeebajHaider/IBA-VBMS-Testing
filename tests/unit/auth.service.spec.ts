import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../iba-backend/src/auth/auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockDb: any;
  let mockJwt: any;

  beforeEach(() => {
    // Chainable Supabase mock.
    // Every intermediate method returns `this` (mockDb itself) so the chain keeps going.
    // Terminal methods (single, maybeSingle) are left as bare jest.fn() — each test sets
    // their return value with mockResolvedValue().
    mockDb = {
      from:        jest.fn().mockReturnThis(),
      select:      jest.fn().mockReturnThis(),
      eq:          jest.fn().mockReturnThis(),
      single:      jest.fn(),
      maybeSingle: jest.fn(),
      insert:      jest.fn().mockReturnThis(),
    };

    // JwtService mock: sign() returns a predictable string instead of doing real crypto.
    mockJwt = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    // Direct instantiation — bypasses NestJS DI entirely.
    // SupabaseService exposes its client as `.db`, so we wrap mockDb accordingly.
    service = new AuthService({ db: mockDb } as any, mockJwt as any);
  });

  // ── UT-001 (already written — keeping it here so the file stays complete) ─
  describe('UT-001: hashPassword', () => {
    it('returns a bcrypt hash with 10 rounds', async () => {
      const hash = await service.hashPassword('password123');
      expect(hash).toMatch(/^\$2[ab]\$10\$/);
    });

    it('produces a different hash on each call (random salt)', async () => {
      const h1 = await service.hashPassword('same');
      const h2 = await service.hashPassword('same');
      expect(h1).not.toBe(h2);
    });
  });

  // ── UT-002 ────────────────────────────────────────────────────────────────
  describe('UT-002: login — happy path', () => {
    it('returns access_token and user object (without password) on valid credentials', async () => {
      // Arrange ---------------------------------------------------------------
      // Pre-hash the password exactly as the real app would store it in the DB.
      const storedHash = await bcrypt.hash('correct-password', 10);

      // Tell the mock: when .single() is eventually called at the end of the
      // from().select().eq().single() chain, resolve with this fake DB row.
      mockDb.single.mockResolvedValue({
        data: {
          id:       'user-uuid-123',
          erp:      '12345',
          name:     'Ali Hassan',
          email:    'ali@iba.edu.pk',
          role:     'student',
          password: storedHash,   // what the DB would really return
        },
        error: null,
      });

      // Act -------------------------------------------------------------------
      // Real signature is login(erp: string, password: string) — two args, not one object.
      const result = await service.login('12345', 'correct-password');

      // Assert ----------------------------------------------------------------
      // 1. Token is whatever our mock JWT sign() returns
      expect(result.access_token).toBe('mock-jwt-token');

      // 2. User object has the right shape
      expect(result.user.erp).toBe('12345');
      expect(result.user.role).toBe('student');

      // 3. CRITICAL security check: password must NOT appear in the response.
      // We cast to `any` because TypeScript already excludes `password` from the
      // return type — but we want to explicitly verify the runtime value too.
      expect((result.user as any).password).toBeUndefined();

      // 4. JwtService.sign was called with a payload that includes the user's id
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-uuid-123' })
      );
    });
  });

  // ── UT-003 ────────────────────────────────────────────────────────────────
  describe('UT-003: login — unknown ERP', () => {
    it('throws UnauthorizedException("Invalid credentials") when ERP does not exist', async () => {
      // Arrange ---------------------------------------------------------------
      // Simulate the DB returning no user row for this ERP.
      mockDb.single.mockResolvedValue({ data: null, error: null });

      // Act + Assert ----------------------------------------------------------
      // .rejects.toThrow() is the correct Jest pattern for async exceptions.
      // We call service.login() twice: once to check the exception CLASS,
      // once to check the MESSAGE. Both calls hit the same mock.
      await expect(
        service.login('nobody', 'x')
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.login('nobody', 'x')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  // ── UT-004 ────────────────────────────────────────────────────────────────
  describe('UT-004: login — password mismatch', () => {
    it('throws UnauthorizedException("Invalid credentials") when password is wrong', async () => {
      // Arrange ---------------------------------------------------------------
      // Hash a DIFFERENT password to what we'll pass in.
      // The DB "stored" the hash of 'correct-password', but the user types 'wrong-password'.
      const storedHash = await bcrypt.hash('correct-password', 10);

      mockDb.single.mockResolvedValue({
        data: {
          id:       'user-uuid-123',
          erp:      '12345',
          name:     'Ali Hassan',
          email:    'ali@iba.edu.pk',
          role:     'student',
          password: storedHash,   // hash of 'correct-password'
        },
        error: null,
      });

      // Act + Assert ----------------------------------------------------------
      // We pass 'wrong-password' — bcrypt.compare will return false.
      // login() should throw, even though the ERP was found in the DB.
      await expect(
        service.login('12345', 'wrong-password')
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.login('12345', 'wrong-password')
      ).rejects.toThrow('Invalid credentials');
    });
  });
});

