/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
/// <reference types="jest" />
import { Controller, type INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest';

import { SearchController } from '@/modules/search/transport/search.controller';
import { SearchApplicationService } from '@/modules/search/application/search.application.service';
import { SearchPresenter } from '@/modules/search/transport/search.presenter';
import { DRIZZLE } from '@/core/database/drizzle.constants';

import { HomeController } from '@/modules/home/transport/controller/home.controller';
import { HomeApplicationService } from '@/modules/home/application/home.application.service';
import { HomePresenter } from '@/modules/home/transport/presenter/home.presenter';

import { HealthController } from '@/modules/health/health.controller';
import { HealthPresenter } from '@/modules/health/health.presenter';
import { HealthQueueProbe } from '@/modules/health/health-queue-probe';
import { STORAGE_PORT, type StoragePort } from '@/core/storage';
import { RedisService } from '@/core/redis/redis.service';
import { DRIZZLE_READ } from '@/core/database/drizzle.constants';

interface DbHandle {
  execute: jest.Mock;
}
interface RedisHandle {
  ping: jest.Mock;
  getCircuitMetrics: jest.Mock;
}

@Controller('search')
class SearchFixtureController extends SearchController {}

@Controller('home')
class HomeFixtureController extends HomeController {}

@Controller('health')
class HealthFixtureController extends HealthController {}

class FakeStoragePort implements StoragePort {
  // eslint-disable-next-line @typescript-eslint/require-await
  async ping(): Promise<void> {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async upload(): Promise<never> {
    throw new Error('unused');
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(): Promise<void> {
    return;
  }
  deriveUrl(publicId: string): string {
    return `https://fake.test/${publicId}`;
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async createSignedUpload(): Promise<never> {
    throw new Error('unused');
  }
}

describe('search/home/health controllers (E2E)', () => {
  describe('GET /search', () => {
    let app: INestApplication;
    let db: DbHandle;

    beforeEach(async () => {
      db = {
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: jest.fn(async () => ({ rows: [] })),
      };

      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule.forRoot({ logger: false })],
        controllers: [SearchFixtureController],
        providers: [
          SearchPresenter,
          {
            provide: SearchApplicationService,
            useFactory: () => new SearchApplicationService(db as never),
          },
          { provide: DRIZZLE, useValue: db },
        ],
      }).compile();

      app = moduleRef.createNestApplication({ logger: false });
      await app.init();
    });

    afterEach(async () => {
      if (app) await app.close();
    });

    const http = () => request(app.getHttpServer() as App);

    it('returns 200 with empty result arrays when the DB has nothing', async () => {
      const res = await http().get('/search?q=nestjs');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        query: 'nestjs',
        nextCursor: null,
        hasNextPage: false,
      });
      expect((res.body.data as { users: unknown[] }).users).toEqual([]);
      expect((res.body.data as { quizzes: unknown[] }).quizzes).toEqual([]);
    });

    it('is publicly accessible (no auth required)', async () => {
      const res = await http().get('/search?q=hello');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('issues one Drizzle query per search section (5 sections)', async () => {
      await http().get('/search?q=hello');
      expect(db.execute).toHaveBeenCalledTimes(5);
    });

    it('returns a 400-equivalent response for empty query', async () => {
      const res = await http().get('/search?q=');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /home', () => {
    let app: INestApplication;

    // eslint-disable-next-line @typescript-eslint/require-await
    const bundle = async () => ({
      featured: [],
      trending: [],
      popular: [],
      categories: [],
      recentWinners: { winners: [] },
      topPlayers: [],
    });

    beforeEach(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule.forRoot({ logger: false })],
        controllers: [HomeFixtureController],
        providers: [
          HomePresenter,
          { provide: HomeApplicationService, useValue: { getBundle: bundle } },
          { provide: 'QuizApplicationService', useValue: {} },
          { provide: 'CategoryQueryService', useValue: {} },
          { provide: 'RecentWinnersService', useValue: {} },
          { provide: 'LeaderboardService', useValue: {} },
        ],
      }).compile();

      app = moduleRef.createNestApplication({ logger: false });
      await app.init();
    });

    afterEach(async () => {
      if (app) await app.close();
    });

    const http = () => request(app.getHttpServer() as App);

    it('returns 200 with the home bundle envelope', async () => {
      const res = await http().get('/home');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('featured');
      expect(res.body.data).toHaveProperty('trending');
      expect(res.body.data).toHaveProperty('popular');
      expect(res.body.data).toHaveProperty('categories');
      expect(res.body.data).toHaveProperty('recentWinners');
      expect(res.body.data).toHaveProperty('topPlayers');
    });

    it('passes the bundle through the presenter', async () => {
      const res = await http().get('/home');
      expect(Array.isArray((res.body.data as { featured: unknown[] }).featured)).toBe(true);
      expect(Array.isArray((res.body.data as { trending: unknown[] }).trending)).toBe(true);
    });

    it('is publicly accessible (no auth required)', async () => {
      const res = await http().get('/home');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe('GET /health', () => {
    let app: INestApplication;

    // eslint-disable-next-line @typescript-eslint/require-await
    const probeQueue = async () => ({ depth: 0, workerConnected: true });

    beforeEach(async () => {
      const redis: RedisHandle = {
        // eslint-disable-next-line @typescript-eslint/require-await
        ping: jest.fn(async () => 'PONG'),
        getCircuitMetrics: jest.fn(() => ({
          state: 'closed',
          consecutiveFailures: 0,
          shortCircuitedCount: 0,
        })),
      };
      const db: DbHandle = {
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: jest.fn(async () => undefined),
      };

      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule.forRoot({ logger: false })],
        controllers: [HealthFixtureController],
        providers: [
          HealthPresenter,
          { provide: DRIZZLE, useValue: db },
          { provide: RedisService, useValue: redis },
          { provide: STORAGE_PORT, useClass: FakeStoragePort },
          { provide: HealthQueueProbe, useValue: { probeEmailQueue: probeQueue } },
          { provide: DRIZZLE_READ, useValue: db },
        ],
      }).compile();

      app = moduleRef.createNestApplication({ logger: false });
      await app.init();
    });

    afterEach(async () => {
      if (app) await app.close();
    });

    const http = () => request(app.getHttpServer() as App);

    it('returns 200 with status up when every probe is healthy', async () => {
      const res = await http().get('/health');
      expect(res.status).toBe(200);
      expect((res.body.data as { status: string }).status).toBe('up');
    });

    it('reports the email queue and redis circuit state', async () => {
      const res = await http().get('/health');
      const data = res.body.data as {
        emailQueue: { depth: number; workerConnected: boolean };
        redisCircuit: { state: string; consecutiveFailures: number };
      };
      expect(data.emailQueue).toEqual({ depth: 0, workerConnected: true });
      expect(data.redisCircuit.state).toBe('closed');
      expect(data.redisCircuit.consecutiveFailures).toBe(0);
    });

    it('is publicly accessible (no auth required)', async () => {
      const res = await http().get('/health');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('reports down + 503 when the database probe throws', async () => {
      const db: DbHandle = {
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: jest.fn(async () => {
          throw new Error('db gone');
        }),
      };
      const redis: RedisHandle = {
        // eslint-disable-next-line @typescript-eslint/require-await
        ping: jest.fn(async () => 'PONG'),
        getCircuitMetrics: jest.fn(() => ({
          state: 'closed',
          consecutiveFailures: 0,
          shortCircuitedCount: 0,
        })),
      };

      const moduleRef = await Test.createTestingModule({
        imports: [LoggerModule.forRoot({ logger: false })],
        controllers: [HealthFixtureController],
        providers: [
          HealthPresenter,
          { provide: DRIZZLE, useValue: db },
          { provide: RedisService, useValue: redis },
          { provide: STORAGE_PORT, useClass: FakeStoragePort },
          { provide: HealthQueueProbe, useValue: { probeEmailQueue: probeQueue } },
          { provide: DRIZZLE_READ, useValue: db },
        ],
      }).compile();

      const localApp = moduleRef.createNestApplication({ logger: false });
      await localApp.init();
      try {
        const res = await request(localApp.getHttpServer() as App).get('/health');
        expect(res.status).toBe(503);
        expect((res.body.data as { status: string }).status).toBe('down');
      } finally {
        await localApp.close();
      }
    });
  });
});
