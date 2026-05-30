import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../../iba-backend/src/auth/auth.service';

describe('AuthService', () => {

  let service: AuthService;

  beforeEach(() => {
    const mockSupabase = { db: {} } as any;
    const mockJwt     = { sign: jest.fn().mockReturnValue('mock-jwt') } as any;
    service = new AuthService(mockSupabase, mockJwt);
  });

  describe('hashPassword', () => {

    it('UT-001: returns a bcrypt hash with 10 rounds', async () => {
      const plain = 'password123';

      const hash = await service.hashPassword(plain);

      expect(hash).toMatch(/^\$2[ab]\$10\$/);
      const matches = await bcrypt.compare(plain, hash);
      expect(matches).toBe(true);
    });

    it('UT-001b: returns a different hash each call (salt is random)', async () => {
      const hash1 = await service.hashPassword('same-input');
      const hash2 = await service.hashPassword('same-input');

      expect(hash1).not.toEqual(hash2);
    });

  });

});