/// <reference types="jest" />
/**
 * Phase 4 #3 — concurrent-join E2E scaffold.
 *
 * The production code in
 * `quiz-instance.repository.ts#joinInstanceAtomic` takes a
 * `FOR UPDATE` lock on the instance row, then re-reads the
 * player count and rejects if the capacity is exhausted. The
 * accompanying unit test
 * `quiz-instance.repository.race.spec.ts` proves the locking
 * contract in isolation against an in-memory executor.
 *
 * This scaffold documents the *integration* version that needs
 * a real Postgres to verify the row-level `FOR UPDATE`
 * semantics end-to-end. The test is marked `it.skip(...)` until
 * the integration harness is wired up.
 *
 * The recipe (Phase 4 of the audit):
 *   1. Boot AppModule against a test Postgres.
 *   2. Seed an instance with `maxPlayers=1` and a quizVersion.
 *   3. Mint two access tokens for two distinct users.
 *   4. Fire two `POST /api/v1/instances/:id/join` requests
 *      within the same event-loop tick (`Promise.all`).
 *   5. Assert exactly one response is 200 and the other is 400
 *      with code `INSTANCE_FULL`.
 *   6. Assert `quiz_instance_players` has exactly 1 row.
 *
 * The unit test's behavioural contract is intentionally
 * duplicated here so that, when the integration version is
 * unskipped, the assertions line up 1:1.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ApiResponse } from '@/common/responses/api-response';

describe('Phase 4 #3 — concurrent-join integration scaffold', () => {
  let app: INestApplication;

  beforeEach(() => {
    // Filled in when the integration harness is wired up.
    app = {} as INestApplication;
  });

  it.skip('maxPlayers=1 + two concurrent joins → exactly one succeeds', async () => {
    //   const instanceId = await seedInstance({ maxPlayers: 1 });
    //   const [tokenA, tokenB] = await Promise.all([mintToken('u1'), mintToken('u2')]);
    //
    //   const [resA, resB] = await Promise.all([
    //     request(app.getHttpServer() as App)
    //       .post(`/api/v1/instances/${instanceId}/join`)
    //       .set('Authorization', `Bearer ${tokenA}`),
    //     request(app.getHttpServer() as App)
    //       .post(`/api/v1/instances/${instanceId}/join`)
    //       .set('Authorization', `Bearer ${tokenB}`),
    //   ]);
    //
    //   const statuses = [resA.status, resB.status].sort();
    //   expect(statuses).toEqual([200, 400]);
    //
    //   const body = (resB.body as ApiResponseEnvelope<unknown>).data as { code: string };
    //   expect(body.code).toBe('INSTANCE_FULL');
    void ApiResponse;
  });
});
