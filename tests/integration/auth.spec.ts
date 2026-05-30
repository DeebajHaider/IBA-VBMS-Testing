import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp } from './helpers/setup';
import { resetDatabase, seedTestData } from './helpers/seed';

describe('Auth API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  it('API-AUTH-001: valid student login returns 200 with access_token and user object', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ erp: '12345', password: 'student123' });

    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.access_token).toMatch(/^eyJ/);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.erp).toBe('12345');
    expect(res.body.user.role).toBe('student');
    expect(res.body.user.password).toBeUndefined();
  });

  it('API-AUTH-003: wrong password returns 401 with generic message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ erp: '12345', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

});
