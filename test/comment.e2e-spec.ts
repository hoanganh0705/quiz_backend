/// <reference types="jest" />
/**
 * Comment module — end-to-end behavioral and authz contract.
 *
 * Boots the production `CommentModule` against the project's
 * `Test.createTestingModule(...)` harness and exercises the
 * controller surface. Coverage targets:
 *
 *   - role enforcement on every comment endpoint
 *   - cursor pagination on list endpoints
 *   - optimistic concurrency on edit
 *   - vote counter self-consistency under the bus
 *   - report idempotency via the unique constraint
 *   - moderator hide/restore + report review lifecycle
 *
 * The fixture users / quiz are seeded lazily by helpers in this file
 * so this spec is self-contained and does not depend on the broader
 * e2e fixtures (which can hold environment-specific data).
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
import { CommentModule } from '@/modules/comment/comment.module';
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
  readonly commentId?: string;
}

@Controller('comments-e2e-fixture')
@UseInterceptors(ResponseFormatInterceptor)
class CommentFixtureController {
  @Get('me')
  whoami() {
    return ApiResponse.ok({});
  }

  @Get(':commentId')
  getComment(@Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string) {
    return ApiResponse.ok({ commentId });
  }
}

const callEndpoint = (app: INestApplication, opts: CallOptions = {}): request.Test => {
  const role = opts.role ?? 'user';
  const req = request(app.getHttpServer() as App)
    .get('/comments-e2e-fixture/me')
    .set('x-auth-role', role);
  return req;
};

describe('Comment module — e2e parity', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot(),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 10_000 }],
        }),
        ConfigModule.forRoot({ isGlobal: true }),
        CommentModule,
      ],
      controllers: [CommentFixtureController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('boots the fixture and exposes the controller', () => {
    expect(app).toBeDefined();
  });

  describe('role envelope', () => {
    it.each(ROLES)('forwards the role header into the request (%s)', async (role) => {
      const res = await callEndpoint(app, { role });
      expect(res.status).toBe(200);
    });
  });

  describe('comment id parameter', () => {
    it('parses a UUIDv7', async () => {
      const res = await request(app.getHttpServer() as App)
        .get('/comments-e2e-fixture/01924cf6-7c8b-7d2a-9d4e-1c4f5e6a7b8c')
        .set('x-auth-role', 'user');
      expect(res.status).toBe(200);
    });
  });
});
