/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ApiResponse } from '@/common/responses/api-response';

describe('Instance concurrent join (e2e)', () => {
  beforeEach(() => {
    // Filled in when the integration harness is wired up.
    app = {} as INestApplication;
  });

  it.skip('maxPlayers=1 + two concurrent joins → exactly one succeeds', async () => {
    const instanceId = await seedInstance({ maxPlayers: 1 });
    const [tokenA, tokenB] = await Promise.all([mintToken('u1'), mintToken('u2')]);

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer() as App)
        .post(`/api/v1/instances/${instanceId}/join`)
        .set('Authorization', `Bearer ${tokenA}`),
      request(app.getHttpServer() as App)
        .post(`/api/v1/instances/${instanceId}/join`)
        .set('Authorization', `Bearer ${tokenB}`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 400]);

    const body = (resB.body as ApiResponseEnvelope<unknown>).data as { code: string };
    expect(body.code).toBe('INSTANCE_FULL');
    void ApiResponse;
  });
});
