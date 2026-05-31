import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp } from './helpers/setup';
import { resetDatabase, seedTestData } from './helpers/seed';
import { loginAs } from './helpers/auth';

describe('Auth API', () => {
  let app: INestApplication;
  let studentToken: string;
  let poToken: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedTestData();
    studentToken = (await loginAs(app, '12345', 'student123')).token;
    poToken      = (await loginAs(app, 'po001', 'po123')).token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('API-AUTH-001: valid student login returns 201 with token and user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ erp: '12345', password: 'student123' });

    expect(res.status).toBe(201);
    expect(res.body.access_token).toMatch(/^eyJ/);
    expect(res.body.user.role).toBe('student');
    expect(res.body.user.password).toBeUndefined();
  });

  it('API-AUTH-002: valid PO login returns 201 with role=programoffice', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ erp: 'po001', password: 'po123' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('programoffice');
    expect(res.body.access_token).toMatch(/^eyJ/);
    expect(res.body.user.password).toBeUndefined();
  });

  it('API-AUTH-003: wrong password returns 401 with generic message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ erp: '12345', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('API-AUTH-003b: unknown ERP returns identical 401 as wrong password (no enumeration leak)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ erp: 'NOBODY_HERE', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('API-AUTH-004: no token → 401 on protected endpoint', async () => {
    const res = await request(app.getHttpServer()).get('/api/bookings');
    // 401 = unauthenticated. The guard doesn't know who this is at all.
    expect(res.status).toBe(401);
  });

  it('API-AUTH-005: student token → 403 on all admin-only routes', async () => {
    const adminRoutes = [
      { method: 'get',  path: '/api/users' },
      { method: 'post', path: '/api/users' },
      { method: 'post', path: '/api/buildings' },
      { method: 'post', path: '/api/rooms' },
      { method: 'post', path: '/api/blocked-slots' },
    ];

    for (const route of adminRoutes) {
      const res = await (request(app.getHttpServer()) as any)
        [route.method](route.path)
        .set('Authorization', `Bearer ${studentToken}`);

      // 403 = authenticated but wrong role. 401 would mean the token was rejected entirely,
      // which would be a different (worse) bug.
      expect(res.status).toBe(403);
    }
  });

  it('API-AUTH-006: PO token → 403 on user creation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${poToken}`)
      .send({
        erp: 'shouldnotwork',
        name: 'Ghost User',
        email: 'ghost@iba.edu.pk',
        password: 'pw123',
        role: 'student',
      });

    expect(res.status).toBe(403);
  });

  it('API-AUTH-007: garbage token and wrong-secret token both → 401', async () => {
    const garbageRes = await request(app.getHttpServer())
      .get('/api/bookings')
      .set('Authorization', 'Bearer this.is.not.a.token');

    expect(garbageRes.status).toBe(401);

    // A structurally valid JWT but signed with the wrong secret.
    // This is what a forged token looks like. The backend must reject it.
    const forgedToken = jwt.sign(
      { sub: 'hacker', erp: 'admin', role: 'admin' },
      'wrong-secret',
    );

    const forgedRes = await request(app.getHttpServer())
      .get('/api/bookings')
      .set('Authorization', `Bearer ${forgedToken}`);

    expect(forgedRes.status).toBe(401);
  });

  it('API-AUTH-LOGIN-VALIDATION: missing/empty fields → 400 with field-level errors', async () => {
    const emptyRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({});
    expect(emptyRes.status).toBe(400);
    expect(Array.isArray(emptyRes.body.message)).toBe(true);

    const missingPwRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ erp: '12345' });
    expect(missingPwRes.status).toBe(400);
    // message is a flat string array — join and search rather than mapping over objects
    expect(missingPwRes.body.message.join(' ')).toContain('password');

    const emptyStrRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ erp: '', password: '' });
    expect(emptyStrRes.status).toBe(400);
    const joined = emptyStrRes.body.message.join(' ');
    expect(joined).toContain('erp');
    expect(joined).toContain('password');
  });
});

