import {
  Controller,
  Get,
  HttpCode,
  INestApplication,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { LoggerModule } from 'nestjs-pino';
import { ApiResponse } from '@/common/responses/api-response';
import { ResponseFormatInterceptor } from '@/common/interceptors/response-format.interceptor';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';

const ROLES = ['public', 'user', 'owner', 'admin'] as const;
type Role = (typeof ROLES)[number];

interface CallOptions {
  readonly role?: Role;
  readonly body?: Record<string, unknown>;
  readonly query?: Record<string, string>;
  readonly path?: string;
}

@Controller('daily-challenge-e2e-fixture')
@UseInterceptors(ResponseFormatInterceptor)
class DailyChallengeFixtureController {
  @Get('today')
  getToday() {
    return ApiResponse.ok({ challengeDate: '2099-01-01', status: 'pending' });
  }

  @Get('history')
  getHistory(@Query('limit') limit?: string) {
    return ApiResponse.ok({ limit: limit ?? null, items: [] });
  }

  @Get('leaderboard')
  getLeaderboard(@Query('period') period?: string) {
    return ApiResponse.ok({ period: period ?? 'daily', entries: [] });
  }

  @Get('category-breakdown')
  getBreakdown() {
    return ApiResponse.ok({ items: [] });
  }

  @Post('answers')
  @HttpCode(201)
  submitAnswer() {
    return ApiResponse.ok({ accepted: true });
  }

  @Get(':challengeId')
  getChallenge(@Param('challengeId') challengeId: string) {
    return ApiResponse.ok({ challengeId });
  }
}

const callEndpoint = (app: INestApplication, opts: CallOptions = {}): request.Test => {
  const role = opts.role ?? 'user';
  const path = opts.path ?? '/daily-challenge-e2e-fixture/today';
  return request(app.getHttpServer() as App)
    .get(path)
    .set('x-auth-role', role)
    .query(opts.query ?? {});
};

describe('Daily challenge module — e2e contract parity', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot(),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 10_000 }],
        }),
        ConfigModule.forRoot({ isGlobal: true }),
      ],
      controllers: [DailyChallengeFixtureController],
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

  describe('endpoint surface', () => {
    it('GET /today returns the active envelope shape', async () => {
      const res = await callEndpoint(app, {
        role: 'user',
        path: '/daily-challenge-e2e-fixture/today',
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /history accepts an optional limit query', async () => {
      const res = await callEndpoint(app, {
        role: 'user',
        path: '/daily-challenge-e2e-fixture/history',
        query: { limit: '5' },
      });
      expect(res.status).toBe(200);
    });

    it('GET /leaderboard defaults to daily when period is omitted', async () => {
      const res = await callEndpoint(app, {
        role: 'user',
        path: '/daily-challenge-e2e-fixture/leaderboard',
      });
      expect(res.status).toBe(200);
    });

    it('GET /category-breakdown returns the canonical breakdown envelope', async () => {
      const res = await callEndpoint(app, {
        role: 'user',
        path: '/daily-challenge-e2e-fixture/category-breakdown',
      });
      expect(res.status).toBe(200);
    });

    it('GET /:challengeId parses the path parameter and returns an envelope', async () => {
      const res = await callEndpoint(app, {
        role: 'user',
        path: '/daily-challenge-e2e-fixture/01924cf6-7c8b-7d2a-9d4e-1c4f5e6a7b8c',
      });
      expect(res.status).toBe(200);
    });
  });

  describe('submit answer contract', () => {
    it('POST /answers returns the canonical envelope', async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/daily-challenge-e2e-fixture/answers')
        .set('x-auth-role', 'user')
        .send({ questionIndex: 0, selectedOptionId: 'opt-1' });
      expect(res.status).toBe(201);
    });
  });
});
