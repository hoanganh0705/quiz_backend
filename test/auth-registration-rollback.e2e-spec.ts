/// <reference types="jest" />
/**
 * Phase 4 #4 — transaction-rollback E2E scaffold.
 *
 * The production code paths covered here:
 *   1. `UserRepository.createUserWithPasswordHistory` — Phase 0 #2.
 *      Inserts a `users` row and a `password_history` row inside
 *      a single `db.transaction`. If the second insert fails, the
 *      first must roll back.
 *
 *   2. `QuizInstanceRepository.joinInstanceAtomic` — Phase 1 #1.
 *      Inserts a `quiz_instance_players` row inside a row-locked
 *      transaction. If the capacity check rejects, the insert
 *      must not commit.
 *
 *   3. `OutboxAdapter.scheduleEvent` — Phase 2 #2.
 *      Inserts an `outbox_events` row inside the caller's tx.
 *      If the caller's tx rolls back, the event row must not
 *      commit.
 *
 * The accompanying unit tests
 * (`user.repository.transaction.spec.ts` and
 *  `quiz-instance.repository.race.spec.ts`) prove the contracts
 * in isolation against an in-memory executor. This scaffold
 * documents the *integration* versions that need a real Postgres
 * to verify the SQL-level `BEGIN/COMMIT/ROLLBACK` wiring.
 *
 * Recipe (Phase 4 of the audit):
 *   1. Boot AppModule against a test Postgres.
 *   2. Force a constraint violation mid-registration (e.g. by
 *      registering twice with the same email).
 *   3. Assert no orphan user row exists (the registration row
 *      was rolled back).
 *   4. Assert the `password_history` table has no orphan row.
 *
 * The scaffold is intentionally `it.skip(...)` until the
 * integration harness is wired up.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

describe('Phase 4 #4 — transaction-rollback integration scaffold', () => {
  let app: INestApplication;

  beforeEach(() => {
    // Filled in when the integration harness is wired up.
    app = {} as INestApplication;
  });

  it.skip('duplicate-email registration: no orphan user or password-history row', async () => {
    //   const dto = { email: 'r@example.com', username: 'r1', password: 'p' };
    //   const server = app.getHttpServer();
    //   const first = await request(server).post('/api/v1/auth/register').send(dto);
    //   expect(first.status).toBe(201);
    //   const second = await request(server).post('/api/v1/auth/register').send(dto);
    //   expect(second.status).toBe(409);
    //   const [{ count: users }] = await db.execute(sql`
    //     SELECT count(*)::int AS count FROM users WHERE email = ${dto.email}
    //   `);
    //   const [{ count: history }] = await db.execute(sql`
    //     SELECT count(*)::int AS count FROM password_history ph
    //     JOIN users u ON u.user_id = ph.user_id
    //     WHERE u.email = ${dto.email}
    //   `);
    //   expect(users).toBe(1);
    //   expect(history).toBe(1);
  });

  it.skip('user-creation succeeds, password-history insert fails: full rollback', async () => {
    // Force the second insert to fail by mocking
    // `passwordHistory` with a unique-key violation, or by
    // shutting down the DB between the two inserts. After
    // the run, both `users` and `password_history` must be
    // empty for the offending account.
  });

  it.skip('outbox event scheduled inside a rolled-back tx is not persisted', async () => {
    // Wrap a deliberately-failing domain mutation in a
    // transaction that schedules an outbox event. The
    // mutation rolls back, and the outbox row must roll
    // back with it (`SELECT count(*) FROM outbox_events`
    // is unchanged).
  });
});
