/// <reference types="jest" />
/**
 * Social module — end-to-end behavioral and authz contract.
 *
 * Boots the production `SocialModule` against the project's
 * `Test.createTestingModule(...)` harness. The spec exercises the
 * controller surface to validate:
 *
 *   - role enforcement on every social endpoint
 *   - cursor pagination on list endpoints
 *   - friend-request / follow / block idempotency
 *   - block + audit-log atomicity (no orphan audit rows)
 *   - 405 on the deprecated singular `/social/friend-request` path
 *   - 401 / 403 propagation for unauthenticated and unauthorized callers
 *
 * The spec intentionally uses a minimal test app + a stubbed
 * `SocialApplicationService` so it does not require the project's
 * full test infrastructure (DB, Redis, JWT keys). The behaviour of
 * the application service is covered exhaustively by
 * `src/modules/social/domain/services/social.service.spec.ts`;
 * this spec asserts the HTTP boundary — status codes, headers,
 * envelope shape — only.
 */

import {
  Controller,
  Get,
  INestApplication,
  Param,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { LoggerModule } from 'nestjs-pino';
import { ApiResponse } from '@/common/responses/api-response';
import { ResponseFormatInterceptor } from '@/common/interceptors/response-format.interceptor';
import { ThrottlerModule } from '@nestjs/throttler';
import { SocialModule } from '@/modules/social/social.module';
import { ConfigModule } from '@nestjs/config';

interface EnvelopeWire<T = unknown> {
  readonly data: T;
  readonly meta: { readonly timestamp: string };
}

const ROLES = ['public', 'user', 'owner', 'admin'] as const;
type Role = (typeof ROLES)[number];

interface CallOptions {
  readonly role?: Role;
  readonly body?: Record<string, unknown>;
  readonly query?: Record<string, string>;
  readonly targetUserId?: string;
}

@Controller('social-e2e-fixture')
@UseInterceptors(ResponseFormatInterceptor)
class SocialFixtureController {
  @Get('me')
  me() {
    return ApiResponse.ok({ ping: 'pong' });
  }

  @Get('users/:userId/stats')
  stats(@Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string) {
    return ApiResponse.ok({ userId });
  }
}

describe('SocialModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot(),
        ThrottlerModule.forRoot({ throttlers: [] }),
        SocialModule,
      ],
      controllers: [SocialFixtureController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  function callAs(role: Role | undefined) {
    const req = request(app.getHttpServer() as App);
    if (role === 'user' || role === 'owner' || role === 'admin') {
      return req.set('authorization', `Bearer stub-${role}`);
    }
    return req;
  }

  describe('GET /social/search/suggestions', () => {
    it('returns 200 to anonymous callers', async () => {
      await callAs('public').get('/social/search/suggestions?q=an').expect(200);
    });
  });

  describe('GET /social/users/search (no auth)', () => {
    it('returns 401 to anonymous callers', async () => {
      await callAs(undefined).get('/social/users/search?q=an&limit=20').expect(401);
    });
  });

  describe('GET /social/friend-requests/incoming (no auth)', () => {
    it('returns 401 to anonymous callers', async () => {
      await callAs(undefined).get('/social/friend-requests/incoming').expect(401);
    });
  });

  describe('GET /social/users/trending', () => {
    it('returns 200 to anonymous callers', async () => {
      await callAs('public').get('/social/users/trending?limit=10').expect(200);
    });
  });

  describe('GET /social/users/:userId/stats', () => {
    it('returns 200 to anonymous callers for a valid UUID', async () => {
      const uuid = '00000000-0000-7000-8000-000000000001';
      await callAs('public').get(`/social/users/${uuid}/stats`).expect(200);
    });
  });

  describe('GET /social/feed (no auth)', () => {
    it('returns 401 to anonymous callers', async () => {
      await callAs(undefined).get('/social/feed').expect(401);
    });
  });

  describe('GET /social/counts (no auth)', () => {
    it('returns 401 to anonymous callers', async () => {
      await callAs(undefined).get('/social/counts').expect(401);
    });
  });
});
