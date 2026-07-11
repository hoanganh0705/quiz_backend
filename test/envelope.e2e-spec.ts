/// <reference types="jest" />
/**
 * Phase 0 envelope smoke test.
 *
 * Boots an isolated NestJS app with:
 *   - the global ResponseFormatInterceptor (matches production wiring)
 *   - a stub controller that returns `ApiResponse.ok(...)` and
 *     `ApiResponse.page(...)` payloads
 *
 * Then hits each with supertest and asserts the canonical envelope shape on
 * the wire. This is the runtime backstop for the entire migration: if the
 * envelope shape changes, this test breaks first.
 *
 * This test deliberately avoids `AppModule` (which boots Postgres + Redis) so
 * it can run as part of `pnpm test` without infrastructure. As each module
 * gains a presenter in Phase 1/2, real module e2e tests replace these stubs.
 */
import { Controller, Get, INestApplication, UseInterceptors } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { LoggerModule } from 'nestjs-pino';
import { ApiResponse } from '@/common/responses/api-response';
import { ResponseFormatInterceptor } from '@/common/interceptors/response-format.interceptor';

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface EnvelopeWire {
  readonly data: unknown;
  readonly meta: {
    readonly timestamp: string;
    readonly pagination?: Record<string, unknown>;
  };
}

@Controller('envelope-fixture')
@UseInterceptors(ResponseFormatInterceptor)
class EnvelopeFixtureController {
  @Get('single')
  single() {
    return ApiResponse.ok({ message: 'fixture-single' });
  }

  @Get('null')
  nullBody() {
    return ApiResponse.ok(null);
  }

  @Get('cursor')
  cursor() {
    return ApiResponse.page([{ id: 1 }, { id: 2 }], {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor: 'eyJpZCI6Mn0=',
    });
  }

  @Get('offset')
  offset() {
    return ApiResponse.page([{ score: 100 }], {
      kind: 'offset',
      page: 1,
      limit: 20,
      total: 1342,
      hasMore: true,
    });
  }
}

describe('Response envelope (Phase 0 fixture)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot()],
      controllers: [EnvelopeFixtureController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('single-resource envelope', () => {
    it('wraps a single payload as { data, meta.timestamp }', async () => {
      const res = await request(app.getHttpServer()).get('/envelope-fixture/single').expect(200);
      const body = res.body as EnvelopeWire;

      expect(body).toMatchObject({
        data: { message: 'fixture-single' },
      });
      expect(body.meta).toBeDefined();
      expect(body.meta.timestamp).toMatch(ISO_8601);
      expect(body.meta.pagination).toBeUndefined();
    });
  });

  describe('no-body envelope', () => {
    it('renders Promise<void> handlers as { data: null, meta.timestamp }', async () => {
      const res = await request(app.getHttpServer()).get('/envelope-fixture/null').expect(200);
      const body = res.body as EnvelopeWire;

      expect(body).toMatchObject({ data: null });
      expect(body.meta.timestamp).toMatch(ISO_8601);
      expect(body.meta.pagination).toBeUndefined();
    });
  });

  describe('cursor pagination envelope', () => {
    it('wraps list + cursor meta.pagination with kind="cursor"', async () => {
      const res = await request(app.getHttpServer()).get('/envelope-fixture/cursor').expect(200);
      const body = res.body as EnvelopeWire;

      expect(body.data).toEqual([{ id: 1 }, { id: 2 }]);
      expect(body.meta.timestamp).toMatch(ISO_8601);
      expect(body.meta.pagination).toEqual({
        kind: 'cursor',
        limit: 20,
        hasNextPage: true,
        nextCursor: 'eyJpZCI6Mn0=',
      });
    });
  });

  describe('offset pagination envelope', () => {
    it('wraps list + offset meta.pagination with kind="offset"', async () => {
      const res = await request(app.getHttpServer()).get('/envelope-fixture/offset').expect(200);
      const body = res.body as EnvelopeWire;

      expect(body.data).toEqual([{ score: 100 }]);
      expect(body.meta.timestamp).toMatch(ISO_8601);
      expect(body.meta.pagination).toEqual({
        kind: 'offset',
        page: 1,
        limit: 20,
        total: 1342,
        hasMore: true,
      });
    });
  });
});
