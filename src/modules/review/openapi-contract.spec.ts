/// <reference types="jest" />
/**
 * Review module OpenAPI regression guards.
 *
 * Asserts the structural integrity of the review module's portion of
 * `docs/generated/openapi.json` so that the API contract cannot silently
 * regress against the contract documented in
 * `docs/audits/REVIEW_API_CONTRACT_AUDIT.md` (Phase 2, H2).
 *
 * This test verifies the CURRENT state of the spec. Future phases will add
 * stricter checks for security, DTO registration, and path parameter formats.
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

const REVIEW_PATHS = [
  // User review endpoints
  '/reviews/me',
  '/reviews/{reviewId}',
  // Quiz review endpoints
  '/quizzes/{quizId}/reviews',
  '/quizzes/{quizId}/reviews/stats',
  '/quizzes/{quizId}/reviews/analytics',
  '/quizzes/{quizId}/reviews/me',
  // User reviews endpoints
  '/users/me/reviews',
  '/users/me/reported-reviews',
  '/users/me/reviews/{quizId}',
  '/users/{userId}/reviews',
  // Admin review endpoints
  '/admin/reviews/reports',
  '/admin/reviews/reports/{reportId}',
] as const;

const HTTP_METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const isHttpMethod = (key: string): key is HttpMethod =>
  (HTTP_METHODS as readonly string[]).includes(key);

describe('Review module - OpenAPI contract regression guards', () => {
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

  describe('all review endpoints are documented', () => {
    for (const path of REVIEW_PATHS) {
      const fullPath = '/api/v1' + path;

      it(fullPath + ' exists in the spec', () => {
        expect(spec.paths).toHaveProperty(fullPath);
      });
    }
  });

  // ── 3. Success examples are present on every operation ──────────────
  // This is the primary check for H1 - every endpoint should have examples.

  describe('documented success examples (H1)', () => {
    for (const path of REVIEW_PATHS) {
      const fullPath = '/api/v1' + path;

      it('every method on ' + fullPath + ' carries a non-empty success example', () => {
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

  // ── 4. Core review response DTOs are registered ────────────────

  describe('core review response DTOs are registered', () => {
    const requiredDtos = [
      'CreateReviewResponseDto',
      'DeleteReviewResponseDto',
      'HelpfulReviewResponseDto',
      'MyReviewsResponseDto',
      'PlatformReportsResponseDto',
      'ReportReviewResponseDto',
      'ReportedReviewsResponseDto',
      'ReviewDashboardResponseDto',
      'ReviewDetailResponseDto',
      'ReviewListResponseDto',
      'ReviewStatsResponseDto',
      'UpdateReviewResponseDto',
      'UpdateReportStatusResponseDto',
    ];

    for (const dto of requiredDtos) {
      it(dto + ' is present in components.schemas', () => {
        expect(schemas).toHaveProperty(dto);
      });
    }
  });

  // ── 5. Core review request DTOs are registered ────────────────

  describe('core review request DTOs are registered', () => {
    const requiredDtos = [
      'CreateReviewDto',
      'UpdateReviewDto',
      'HelpfulReviewDto',
      'ReportReviewDto',
    ];

    for (const dto of requiredDtos) {
      it(dto + ' is present in components.schemas', () => {
        expect(schemas).toHaveProperty(dto);
      });
    }
  });

  // ── 6. Cursor pagination meta on paginated endpoints ───────────

  describe('cursor pagination meta on paginated endpoints', () => {
    const cursorEndpoints = [
      '/quizzes/{quizId}/reviews',
      '/users/me/reviews',
      '/users/me/reported-reviews',
      '/users/{userId}/reviews',
      '/admin/reviews/reports',
    ];

    for (const path of cursorEndpoints) {
      it('GET /api/v1' + path + ' documents cursor pagination meta', () => {
        const op = spec.paths['/api/v1' + path]?.get;
        const successResponse = op?.responses['200'];
        const example = (successResponse?.content?.['application/json'] as { example?: unknown })
          ?.example;
        expect(example).toBeDefined();
        const obj = example as { meta?: { pagination?: { kind?: string } } };
        expect(obj?.meta?.pagination?.kind).toBe('cursor');
      });
    }
  });
});
