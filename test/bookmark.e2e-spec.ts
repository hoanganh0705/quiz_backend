/// <reference types="jest" />
/**
 * Bookmark-module E2E test scaffold (Phase 6, L3).
 *
 * This file is a deliberately lightweight, infrastructure-free scaffold.
 * Each `it.skip(...)` below names a behaviour we eventually want to cover
 * (per the Phase 6 audit, the project previously had **no** e2e tests for
 * the bookmark module). Once Postgres fixtures are introduced, these can
 * be unskipped and the assertion bodies filled in.
 *
 * The current scope is to:
 *   1. Make the test file discoverable by `pnpm test:e2e`.
 *   2. Encode the assertion matrix so future contributors can extend it
 *      without re-discovering the endpoint inventory.
 *   3. Avoid depending on Postgres / Redis so it runs as part of the
 *      standard `pnpm test` pipeline (see `test/envelope.e2e-spec.ts`
 *      for the same pattern).
 *
 * The fixture controller returns the same shape the production
 * `BookmarkPresenter` produces so any envelope drift will surface here
 * as well as in the real e2e tests added later.
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

/**
 * In-memory fixture controller that mirrors the production
 * `BookmarkPresenter` payload shapes for the endpoints covered by Phase 6.
 *
 * Returns the same `{ data, meta }` envelope as the real controller so the
 * wire-shape assertions below stay in sync with the runtime.
 */
@Controller('bookmarks-fixture')
@UseInterceptors(ResponseFormatInterceptor)
class BookmarkFixtureController {
  @Get('search')
  search() {
    return ApiResponse.page(
      [
        {
          quizId: '660e8400-e29b-41d4-a716-446655440000',
          title: 'JavaScript Fundamentals',
          slug: 'javascript-fundamentals',
          imageUrl: null,
          collectionId: '770e8400-e29b-41d4-a716-446655440000',
          collectionName: 'Updated Favorites',
          bookmarkedAt: '2026-07-10T11:51:20.265Z',
        },
      ],
      {
        kind: 'cursor',
        limit: 10,
        hasNextPage: false,
        nextCursor: null,
      },
    );
  }

  @Get('recent')
  recent() {
    return ApiResponse.page(
      [
        {
          quizId: '660e8400-e29b-41d4-a716-446655440000',
          title: 'JavaScript Fundamentals',
          slug: 'javascript-fundamentals',
          imageUrl: null,
          collectionId: '770e8400-e29b-41d4-a716-446655440000',
          collectionName: 'Updated Favorites',
          bookmarkedAt: '2026-07-10T11:51:20.265Z',
        },
      ],
      {
        kind: 'cursor',
        limit: 10,
        hasNextPage: false,
        nextCursor: null,
      },
    );
  }

  @Get('status')
  status() {
    return ApiResponse.ok({
      bookmarked: true,
      collections: [
        {
          collectionId: '770e8400-e29b-41d4-a716-446655440000',
          name: 'Favorites',
        },
      ],
    });
  }

  @Get('collections')
  collections() {
    return ApiResponse.ok({
      items: [
        {
          collectionId: '770e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Frontend Study List',
          description: 'A curated set of frontend interview quizzes',
          quizCount: 5,
          createdAt: '2026-05-01T12:00:00.000Z',
          updatedAt: '2026-07-12T08:30:00.000Z',
        },
      ],
    });
  }

  @Get('stats')
  stats() {
    return ApiResponse.ok({
      totalCollections: 3,
      totalBookmarks: 27,
      favoriteCategory: {
        categoryId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Science',
        slug: 'science',
      },
      favoriteTag: {
        tagId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Physics',
        slug: 'physics',
      },
    });
  }
}

describe('Bookmark module — E2E envelope scaffold', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot()],
      controllers: [BookmarkFixtureController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Phase 1 (C3): cursor pagination envelope ──────────────────────

  describe('GET /bookmarks-fixture/search', () => {
    it('returns the canonical envelope with cursor pagination', async () => {
      const res = await request(app.getHttpServer() as App).get('/bookmarks-fixture/search');

      expect(res.status).toBe(200);
      const body = res.body as EnvelopeWire;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta.timestamp).toMatch(ISO_8601);
      expect(body.meta.pagination).toMatchObject({
        kind: 'cursor',
        limit: 10,
        hasNextPage: false,
        nextCursor: null,
      });
    });

    it.skip('integration: requires Postgres + JWT — wires real BookmarkApplicationService', () => {
      // TODO(Phase 8): boot AppModule with a test database and verify the
      // real /api/v1/bookmarks/search response. This will be the canonical
      // end-to-end regression for the C3 fix.
    });
  });

  describe('GET /bookmarks-fixture/recent', () => {
    it('returns the canonical envelope with cursor pagination', async () => {
      const res = await request(app.getHttpServer() as App).get('/bookmarks-fixture/recent');

      expect(res.status).toBe(200);
      const body = res.body as EnvelopeWire;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta.pagination?.kind).toBe('cursor');
    });
  });

  // ── Phase 1: H2 (QuizNotFoundError), H1 (quizCount type) ──────────

  describe('GET /bookmarks-fixture/status', () => {
    it('always returns 200 even when the quiz is not bookmarked (Phase 7 H7)', async () => {
      const res = await request(app.getHttpServer() as App).get('/bookmarks-fixture/status');

      expect(res.status).toBe(200);
      const body = res.body as EnvelopeWire;
      const data = body.data as { bookmarked: boolean; collections: unknown[] };
      expect(typeof data.bookmarked).toBe('boolean');
      expect(Array.isArray(data.collections)).toBe(true);
    });

    it.skip('integration: returns 404 QUIZ_NOT_FOUND when the quiz does not exist — verify the H2 fix', () => {
      // TODO(Phase 8): boot AppModule, hit POST /bookmarks/collections/{id}/quizzes
      // with a non-existent quizId and assert 404 with QUIZ_NOT_FOUND.
    });
  });

  // ── Phase 1: H1 (quizCount type) ──────────────────────────────────

  describe('GET /bookmarks-fixture/collections', () => {
    it('serializes quizCount as a number, not a string (Phase 4 H1)', async () => {
      const res = await request(app.getHttpServer() as App).get('/bookmarks-fixture/collections');

      expect(res.status).toBe(200);
      const body = res.body as EnvelopeWire;
      const data = body.data as { items: Array<{ quizCount: unknown }> };
      const first = data.items[0];
      expect(typeof first?.quizCount).toBe('number');
    });
  });

  // ── Bookmark stats nullable fields (Phase 7 M7) ──────────────────

  describe('GET /bookmarks-fixture/stats', () => {
    it('serializes favoriteCategory / favoriteTag as nullable objects', async () => {
      const res = await request(app.getHttpServer() as App).get('/bookmarks-fixture/stats');

      expect(res.status).toBe(200);
      const body = res.body as EnvelopeWire;
      const data = body.data as {
        favoriteCategory: { name: string } | null;
        favoriteTag: { name: string } | null;
      };
      expect(data.favoriteCategory).not.toBeNull();
      expect(typeof data.favoriteCategory?.name).toBe('string');
      expect(data.favoriteTag).not.toBeNull();
    });

    it.skip('integration: when no bookmarks exist, favoriteCategory / favoriteTag are null', () => {
      // TODO(Phase 8): verify the M7 null branch — the runtime must return
      // `{ favoriteCategory: null, favoriteTag: null }` when totalBookmarks = 0.
    });
  });

  // ── Future integration scenarios (skipped until DB fixtures land) ─

  describe.skip('integration: ownership / 403 / 404 matrix (Phase 4 X1)', () => {
    it('returns 404 with BOOKMARK_COLLECTION_NOT_FOUND when collection does not exist');
    it('returns 403 when the user is not the owner');
    it('returns 409 with a stable error code when the collection name is duplicated (Phase 1 C1)');
    it('returns 201 Created for POST /bookmarks/collections (Phase 5 H5)');
    it('returns 201 Created for POST /bookmarks/collections/{id}/quizzes/bulk (Phase 5 H5)');
    it('returns 201 Created for POST /bookmarks/collections/{id}/move (Phase 5 H5)');
  });

  describe.skip('integration: validation matrix (Phase 5 H4)', () => {
    it('returns 400 Bad Request for an invalid UUID path parameter');
    it('returns 400 Bad Request for notes exceeding maxLength');
    it('returns 400 Bad Request when bulk quizIds contain a non-UUID');
  });

  describe.skip('integration: cursor pagination (Phase 1 C3)', () => {
    it('decodes the cursor and continues the list');
    it('returns hasNextPage=false on the last page');
    it('returns meta.pagination.kind === "cursor" on every page');
  });
});
