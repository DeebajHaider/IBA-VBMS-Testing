import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp } from './helpers/setup';
import { resetDatabase, seedTestData } from './helpers/seed';
import { loginAs } from './helpers/auth';

describe('Admin API', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedTestData();
    adminToken = (await loginAs(app, 'admin', 'admin123')).token;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── API-ADMIN-001 ─────────────────────────────────────────────────────────

  it('API-ADMIN-001: admin creates a student account — returns 201 without password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        erp:      'new001',
        name:     'New Student',
        email:    'new@iba.edu.pk',
        password: 'pw123',
        role:     'student',
      });

    expect(res.status).toBe(201);
    expect(res.body.erp).toBe('new001');
    expect(res.body.role).toBe('student');
    // id and created_at must exist — confirms the row was actually inserted
    expect(res.body.id).toBeDefined();
    expect(res.body.created_at).toBeDefined();
    // The password must never appear in any user-facing response
    expect(res.body.password).toBeUndefined();
  });

  // ── API-ADMIN-002 ─────────────────────────────────────────────────────────

  it('API-ADMIN-002: duplicate ERP → 409 Conflict', async () => {
    const payload = {
      erp:      'dup001',
      name:     'First User',
      email:    'first@iba.edu.pk',
      password: 'pw123',
      role:     'student',
    };

    // First creation must succeed
    const first = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(first.status).toBe(201);

    // Second creation with the same ERP must be rejected
    const second = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, email: 'second@iba.edu.pk' }); // different email, same erp

    expect(second.status).toBe(409);
    expect(second.body.message.toLowerCase()).toContain('already exists');
  });

  // ── API-ADMIN-002b ────────────────────────────────────────────────────────

  it('API-ADMIN-002b: invalid email format → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        erp:      'val001',
        name:     'Val User',
        email:    'not-an-email',  // fails @IsEmail()
        password: 'pw123',
        role:     'student',
      });

    expect(res.status).toBe(400);
    // message is an array of validation error objects; we serialise it to search easily
    expect(JSON.stringify(res.body.message)).toContain('email');
  });

  it('API-ADMIN-002b: invalid role value → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        erp:      'val002',
        name:     'Val User',
        email:    'val@iba.edu.pk',
        password: 'pw123',
        role:     'superuser',   // not in ['student', 'programoffice', 'admin']
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('role');
  });
});

