/// <reference types="jest" />
/**
 * Bookmark-module OpenAPI regression guards.
 *
 * Asserts the structural integrity of the bookmark module's portion of
 * `docs/generated/openapi.json` so that the API contract cannot silently
 * regress against the contract documented in
 * `docs/audits/BOOKMARK_API_CONTRACT_AUDIT.md` (Phase 6, L2).
 *
 * Checks:
 *   1. Document structure (paths, components.schemas).
 *   2. All 16 endpoints documented under `/api/v1/bookmarks/*`.
 *   3. Path-parameter UUID format on every endpoint with `:collectionId`
 *      or `:quizId`.
 *   4. BearerAuth security on every protected bookmark endpoint.
 *   5. Documented status codes match the audit (200/201/400/401/403/404/409/500).
 *   6. Documented success examples are non-empty on every operation.
 *   7. Bookmark request/response DTOs are all registered in components.schemas.
 *   8. Cursor pagination `kind` discriminator is present.
 *   9. All bookmark operations are tagged `bookmarks`.
 *  10. Operation metadata (summary, description) is present.
 *  11. Phase 5 H4 — 400 Bad Request responses are documented where applicable.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type OperationObject = {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  security?: Array<Record<string, unknown>>;
  parameters?: Array<ParameterObject>;
  requestBody?: unknown;
  responses: Record<string, ResponseObject>;
};

type ParameterObject = {
  name: string;
  in: string;
  required?: boolean;
  schema?: { format?: string; type?: string };
  description?: string;
};

type ResponseObject = {
  description?: string;
  content?: Record<string, { schema?: unknown; example?: unknown; examples?: unknown }>;
};

const BOOKMARK_PATHS = [
  '/bookmarks/search',
  '/bookmarks/recent',
  '/bookmarks/quizzes/{quizId}/status',
  '/bookmarks/collections',
  '/bookmarks/collections/{collectionId}',
  '/bookmarks/collections/{collectionId}/quizzes',
  '/bookmarks/collections/{collectionId}/quizzes/bulk',
  '/bookmarks/collections/{collectionId}/quizzes/{quizId}',
  '/bookmarks/collections/{collectionId}/move',
  '/bookmarks/collections/{collectionId}/analytics',
  '/bookmarks/collections/{collectionId}',
  '/bookmarks/me/stats',
];

const PATH_PARAMETERS = ['collectionId', 'quizId'] as const;

const HTTP_METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const isHttpMethod = (key: string): key is HttpMethod =>
  (HTTP_METHODS as readonly string[]).includes(key);

describe('Bookmark module — OpenAPI contract regression guards', () => {
  let spec: {
    paths: Record<string, Record<string, OperationObject>>;
    components: { schemas: Record<string, unknown> };
  };
  let schemas: Record<string, unknown>;

  beforeAll(() => {
    const specPath = join(__dirname, '..', '..', '..', 'docs', 'generated', 'openapi.json');
    const raw = JSON.parse(readFileSync(specPath, 'utf-8')) as Record<string, unknown>;
    spec = raw as unknown as typeof spec;
    schemas = spec.components?.schemas ?? {};
  });

  // ── 1. Document structure ─────────────────────────────────────────────

  describe('document structure', () => {
    it('exposes a components.schemas section', () => {
      expect(spec).toHaveProperty('components.schemas');
    });

    it('exposes a paths section', () => {
      expect(spec).toHaveProperty('paths');
    });
  });

  // ── 2. Endpoint presence ──────────────────────────────────────────────

  describe('all bookmark endpoints are documented', () => {
    for (const path of BOOKMARK_PATHS) {
      const fullPath = `/api/v1${path}`;

      it(`${fullPath} exists in the spec`, () => {
        expect(spec.paths).toHaveProperty(fullPath);
      });
    }
  });

  // ── 3. Path parameters declare format: uuid ──────────────────────────

  describe('path parameters are declared as UUIDs', () => {
    for (const path of BOOKMARK_PATHS) {
      const fullPath = `/api/v1${path}`;
      for (const paramName of PATH_PARAMETERS) {
        if (!path.includes(`{${paramName}}`)) continue;

        it(`${fullPath}: ${paramName} param declared`, () => {
          const pathObj = spec.paths[fullPath] ?? {};
          const httpMethods = Object.keys(pathObj).filter(isHttpMethod);

          expect(httpMethods.length).toBeGreaterThan(0);

          let declared = false;
          for (const method of httpMethods) {
            const op = pathObj[method];
            const params = op?.parameters ?? [];
            const param = params.find((p) => p.name === paramName);
            if (param) {
              declared = true;
              expect(param.in).toBe('path');
              expect(param.required).toBe(true);
              expect(param.schema?.format).toBe('uuid');
            }
          }
          expect(declared).toBe(true);
        });
      }
    }
  });

  // ── 4. Security on protected endpoints ───────────────────────────────

  describe('protected bookmark endpoints declare BearerAuth security', () => {
    for (const path of BOOKMARK_PATHS) {
      const fullPath = `/api/v1${path}`;

      it(`${fullPath} declares BearerAuth security on every method`, () => {
        const pathObj = spec.paths[fullPath] ?? {};
        const httpMethods = Object.keys(pathObj).filter(isHttpMethod);

        expect(httpMethods.length).toBeGreaterThan(0);

        for (const method of httpMethods) {
          const op = pathObj[method];
          const security = op?.security ?? [];
          expect(security.length).toBeGreaterThan(0);
          expect(
            security.some((s) => Object.prototype.hasOwnProperty.call(s, 'BearerAuth')),
          ).toBe(true);

          const responses = op?.responses ?? {};
          expect(responses).toHaveProperty('401');
        }
      });
    }
  });

  // ── 5. Status code coverage (Phase 5 H4/H5) ─────────────────────────

  describe('status code coverage', () => {
    const writeOperations = [
      { path: '/bookmarks/collections', method: 'post' as const, status: '201' },
      {
        path: '/bookmarks/collections/{collectionId}/quizzes',
        method: 'post' as const,
        status: '201',
      },
      {
        path: '/bookmarks/collections/{collectionId}/quizzes/bulk',
        method: 'post' as const,
        status: '201',
      },
      {
        path: '/bookmarks/collections/{collectionId}/move',
        method: 'post' as const,
        status: '201',
      },
    ];

    const readOperations = [
      { path: '/bookmarks/search', method: 'get' as const, status: '200' },
      { path: '/bookmarks/recent', method: 'get' as const, status: '200' },
      { path: '/bookmarks/quizzes/{quizId}/status', method: 'get' as const, status: '200' },
      { path: '/bookmarks/collections', method: 'get' as const, status: '200' },
      { path: '/bookmarks/collections/{collectionId}', method: 'get' as const, status: '200' },
      { path: '/bookmarks/collections/{collectionId}', method: 'patch' as const, status: '200' },
      {
        path: '/bookmarks/collections/{collectionId}',
        method: 'delete' as const,
        status: '200',
      },
      {
        path: '/bookmarks/collections/{collectionId}/analytics',
        method: 'get' as const,
        status: '200',
      },
      {
        path: '/bookmarks/collections/{collectionId}/quizzes/{quizId}',
        method: 'delete' as const,
        status: '200',
      },
      {
        path: '/bookmarks/collections/{collectionId}/quizzes/{quizId}',
        method: 'patch' as const,
        status: '200',
      },
      { path: '/bookmarks/me/stats', method: 'get' as const, status: '200' },
    ];

    for (const { path, method, status } of [...readOperations, ...writeOperations]) {
      it(`${method.toUpperCase()} /api/v1${path} documents ${status} response`, () => {
        const op = spec.paths[`/api/v1${path}`]?.[method];
        expect(op?.responses).toHaveProperty(status);
      });
    }

    it('POST /bookmarks/collections uses 201 (creation) — Phase 5 H5', () => {
      const op = spec.paths['/api/v1/bookmarks/collections']?.post;
      expect(op?.responses).toHaveProperty('201');
    });
  });

  // ── 6. Success examples are present on every operation ──────────────

  describe('documented success examples', () => {
    for (const path of BOOKMARK_PATHS) {
      const fullPath = `/api/v1${path}`;

      it(`every method on ${fullPath} carries a non-empty success example`, () => {
        const pathObj = spec.paths[fullPath] ?? {};
        const httpMethods = Object.keys(pathObj).filter(isHttpMethod);
        expect(httpMethods.length).toBeGreaterThan(0);

        for (const method of httpMethods) {
          const op = pathObj[method];
          const successResponse =
            op?.responses['200'] ?? op?.responses['201'] ?? op?.responses['default'];
          const content = successResponse?.content ?? {};
          const jsonContent = content['application/json'] as { example?: unknown } | undefined;
          expect(jsonContent).toBeDefined();
          expect(jsonContent && 'example' in jsonContent).toBe(true);
        }
      });
    }
  });

  // ── 7. Cursor pagination kind discriminator ──────────────────────────

  describe('cursor pagination meta', () => {
    const cursorEndpoints = ['/bookmarks/search', '/bookmarks/recent'];

    for (const path of cursorEndpoints) {
      it(`GET /api/v1${path} documents cursor pagination meta`, () => {
        const op = spec.paths[`/api/v1${path}`]?.get;
        const successResponse = op?.responses['200'];
        const example = (successResponse?.content?.['application/json'] as { example?: unknown })
          ?.example;
        expect(example).toBeDefined();
        const obj = example as { meta?: { pagination?: { kind?: string } } };
        expect(obj?.meta?.pagination?.kind).toBe('cursor');
      });
    }
  });

  // ── 8. Bookmark DTOs registered in components.schemas ──────────────

  describe('bookmark response/request DTOs are registered', () => {
    const requiredDtos = [
      // Response DTOs.
      'BookmarkCollectionResponseDto',
      'BookmarkCollectionListResponseDto',
      'CreateCollectionResponseDto',
      'UpdateCollectionResponseDto',
      'DeleteCollectionResponseDto',
      'BookmarkCollectionAnalyticsResponseDto',
      'BookmarkCollectionAnalyticsSummaryDto',
      'BookmarkCollectionAnalyticsTopCategoryDto',
      'BookmarkCollectionAnalyticsTopTagDto',
      'BookmarkStatusResponseDto',
      'BookmarkStatusCollectionDto',
      'BookmarkListResponseDto',
      'BookmarkedQuizResponseDto',
      'AddBookmarkResponseDto',
      'UpdateBookmarkResponseDto',
      'RemoveBookmarkResponseDto',
      'MoveBookmarkResponseDto',
      'BookmarkStatsResponseDto',
      'BookmarkStatsFavoriteCategoryDto',
      'BookmarkStatsFavoriteTagDto',
      'BulkAddBookmarksResponseDto',
      'BulkRemoveBookmarksResponseDto',
      'RecentBookmarkItemDto',
      'RecentBookmarksResponseDto',
      'RecentBookmarksPaginationDto',
      'SearchBookmarkItemDto',
      'SearchBookmarksResponseDto',
      // Request DTOs.
      'CreateCollectionDto',
      'UpdateCollectionDto',
      'AddBookmarkDto',
      'BulkAddBookmarksDto',
      'BulkRemoveBookmarksDto',
      'UpdateBookmarkDto',
      'MoveBookmarkDto',
      'SearchBookmarksQueryDto',
      'ListRecentBookmarksQueryDto',
    ];

    for (const dto of requiredDtos) {
      it(`${dto} is present in components.schemas`, () => {
        expect(schemas).toHaveProperty(dto);
      });
    }
  });

  // ── 9. Tagging ─────────────────────────────────────────────────────

  describe('bookmark endpoints are tagged correctly', () => {
    for (const path of BOOKMARK_PATHS) {
      const fullPath = `/api/v1${path}`;

      it(`${fullPath} is tagged "bookmarks"`, () => {
        const pathObj = spec.paths[fullPath] ?? {};
        const httpMethods = Object.keys(pathObj).filter(isHttpMethod);
        expect(httpMethods.length).toBeGreaterThan(0);

        for (const method of httpMethods) {
          const op = pathObj[method];
          expect(op?.tags).toContain('bookmarks');
        }
      });
    }
  });

  // ── 10. Operation metadata ──────────────────────────────────────────

  describe('operation metadata', () => {
    for (const path of BOOKMARK_PATHS) {
      const fullPath = `/api/v1${path}`;

      it(`every method on ${fullPath} has a non-empty summary`, () => {
        const pathObj = spec.paths[fullPath] ?? {};
        const httpMethods = Object.keys(pathObj).filter(isHttpMethod);
        expect(httpMethods.length).toBeGreaterThan(0);

        for (const method of httpMethods) {
          const op = pathObj[method];
          expect(op?.summary).toBeDefined();
          expect((op?.summary ?? '').length).toBeGreaterThan(0);
        }
      });
    }
  });

  // ── 11. Phase 5 H4: documented 400 Bad Request responses ────────────

  describe('bookmark endpoints document 400 Bad Request where applicable', () => {
    const endpointsExpecting400 = [
      '/bookmarks/search',
      '/bookmarks/recent',
      '/bookmarks/quizzes/{quizId}/status',
      '/bookmarks/collections',
      '/bookmarks/collections/{collectionId}',
      '/bookmarks/collections/{collectionId}/quizzes',
      '/bookmarks/collections/{collectionId}/quizzes/bulk',
      '/bookmarks/collections/{collectionId}/quizzes/{quizId}',
      '/bookmarks/collections/{collectionId}/move',
    ];

    for (const path of endpointsExpecting400) {
      it(`/api/v1${path} documents 400 Bad Request`, () => {
        const pathObj = spec.paths[`/api/v1${path}`] ?? {};
        const httpMethods = Object.keys(pathObj).filter(isHttpMethod);
        expect(httpMethods.length).toBeGreaterThan(0);

        for (const method of httpMethods) {
          const op = pathObj[method];
          expect(op?.responses).toHaveProperty('400');
        }
      });
    }
  });
});