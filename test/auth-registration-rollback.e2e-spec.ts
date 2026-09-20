/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

describe('Transaction rollback (e2e)', () => {
  let app: INestApplication;

  beforeEach(() => {
    // Filled in when the integration harness is wired up.
    app = {} as INestApplication;
  });

  it.skip('duplicate-email registration: no orphan user or password-history row', async () => {
    const dto = { email: 'r@example.com', username: 'r1', password: 'p' };
    const server = app.getHttpServer();
    const first = await request(server).post('/api/v1/auth/register').send(dto);
    expect(first.status).toBe(201);
    const second = await request(server).post('/api/v1/auth/register').send(dto);
    expect(second.status).toBe(409);
    const [{ count: users }] = await db.execute(sql`
        SELECT count(*)::int AS count FROM users WHERE email = ${dto.email}
      `);
    const [{ count: history }] = await db.execute(sql`
        SELECT count(*)::int AS count FROM password_history ph
        JOIN users u ON u.user_id = ph.user_id
        WHERE u.email = ${dto.email}
      `);
    expect(users).toBe(1);
    expect(history).toBe(1);
  });

  it.skip('user-creation succeeds, password-history insert fails: full rollback', async () => {});

  it.skip('outbox event scheduled inside a rolled-back tx is not persisted', async () => {});
});
