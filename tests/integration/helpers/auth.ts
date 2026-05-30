import request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function loginAs(
  app: INestApplication,
  erp: string,
  password: string,
): Promise<{ token: string; user: any }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ erp, password });

  if (!res.body.access_token) {
    throw new Error(
      `loginAs(${erp}) failed — status ${res.status}, body: ${JSON.stringify(res.body)}`
    );
  }

  return {
    token: res.body.access_token,
    user: res.body.user,
  };
}
