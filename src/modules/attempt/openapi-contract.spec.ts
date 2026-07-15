/// <reference types="jest" />
/**
 * Attempt-module OpenAPI regression guards.
 *
 * This test asserts the structural integrity of the attempt module's portion
 * of `docs/generated/openapi.json` so that the API contract cannot silently
 * regress.
 *
 * Checks:
 *   1. Path-parameter UUID format is present on every attempt-related route.
 *   2. BearerAuth security is documented on every protected attempt endpoint.
 *   3. All expected attempt endpoints are present (no missing routes).
 *   4. Schemas referenced by attempt endpoints resolve.
 *   5. Documented HTTP status codes match the audit report.
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
  content?: Record<string, { schema?: unknown }>;
};

const ATTEMPT_PATHS = [
  '/quizzes/{quizId}/attempts',
  '/attempts/{attemptId}',
  '/attempts/{attemptId}/answers',
  '/attempts/{attemptId}/answers/{questionId}',
  '/attempts/{attemptId}/abandon',
  '/attempts/{attemptId}/complete',
  '/attempts/{attemptId}/analytics',
  '/users/me/attempts',
  '/users/me/attempts/stats',
];

const PATH_PARAMETERS = ['quizId', 'attemptId', 'questionId'] as const;

const HTTP_METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const isHttpMethod = (key: string): key is HttpMethod =>
  (HTTP_METHODS as readonly string[]).includes(key);

describe('Attempt module — OpenAPI contract regression guards', () => {
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

  // ── 1. Document structure ──────────────────────────────────────────────

  describe('document structure', () => {
    it('exposes a components.schemas section', () => {
      expect(spec).toHaveProperty('components.schemas');
    });

    it('exposes a paths section', () => {
      expect(spec).toHaveProperty('paths');
    });
  });

  // ── 2. Endpoint presence ──────────────────────────────────────────────

  describe('all attempt endpoints are documented', () => {
    for (const path of ATTEMPT_PATHS) {
      const fullPath = `/api/v1${path}`;

      it(`${fullPath} exists in the spec`, () => {
        expect(spec.paths).toHaveProperty(fullPath);
      });
    }
  });

  // ── 3. Path parameters declare format: uuid ──────────────────────────

  describe('path parameters are declared as UUIDs', () => {
    for (const path of ATTEMPT_PATHS) {
      const fullPath = `/api/v1${path}`;
      for (const paramName of PATH_PARAMETERS) {
        if (!path.includes(`{${paramName}}`)) continue;

        it(`${fullPath}: ${paramName} param declared`, () => {
          const pathObj = spec.paths[fullPath] ?? {};
          const httpMethods = Object.keys(pathObj).filter(isHttpMethod);

          // At least one method should declare the path parameter.
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

  describe('protected attempt endpoints declare BearerAuth security', () => {
    for (const path of ATTEMPT_PATHS) {
      const fullPath = `/api/v1${path}`;

      it(`${fullPath} declares BearerAuth security on every method`, () => {
        const pathObj = spec.paths[fullPath] ?? {};
        const httpMethods = Object.keys(pathObj).filter(isHttpMethod);

        expect(httpMethods.length).toBeGreaterThan(0);

        for (const method of httpMethods) {
          const op = pathObj[method];
          const security = op?.security ?? [];
          expect(security.length).toBeGreaterThan(0);
          expect(security.some((s) => Object.prototype.hasOwnProperty.call(s, 'BearerAuth'))).toBe(
            true,
          );

          const responses = op?.responses ?? {};
          expect(responses).toHaveProperty('401');
        }
      });
    }
  });

  // ── 5. Operation metadata ───────────────────────────────────────────

  describe('operation metadata', () => {
    const operationsExpectingSummary = [
      { path: '/quizzes/{quizId}/attempts', method: 'post' as const },
      { path: '/attempts/{attemptId}', method: 'get' as const },
      { path: '/attempts/{attemptId}/answers', method: 'post' as const },
      { path: '/attempts/{attemptId}/answers/{questionId}', method: 'delete' as const },
      { path: '/attempts/{attemptId}/abandon', method: 'post' as const },
      { path: '/attempts/{attemptId}/complete', method: 'post' as const },
      { path: '/attempts/{attemptId}/analytics', method: 'get' as const },
      { path: '/users/me/attempts', method: 'get' as const },
      { path: '/users/me/attempts/stats', method: 'get' as const },
    ];

    for (const { path, method } of operationsExpectingSummary) {
      it(`${method.toUpperCase()} ${path} has a non-empty summary`, () => {
        const op = spec.paths[`/api/v1${path}`]?.[method];
        expect(op?.summary).toBeDefined();
        expect((op?.summary ?? '').length).toBeGreaterThan(0);
      });

      it(`${method.toUpperCase()} ${path} has a non-empty description`, () => {
        const op = spec.paths[`/api/v1${path}`]?.[method];
        expect(op?.description).toBeDefined();
        expect((op?.description ?? '').length).toBeGreaterThan(0);
      });
    }
  });

  // ── 6. Status code coverage ──────────────────────────────────────────

  describe('status code coverage', () => {
    const operationsExpectingOk = [
      { path: '/quizzes/{quizId}/attempts', method: 'post' as const, status: '201' },
      { path: '/attempts/{attemptId}', method: 'get' as const, status: '200' },
      { path: '/attempts/{attemptId}/answers', method: 'post' as const, status: '201' },
      {
        path: '/attempts/{attemptId}/answers/{questionId}',
        method: 'delete' as const,
        status: '200',
      },
      { path: '/attempts/{attemptId}/abandon', method: 'post' as const, status: '200' },
      { path: '/attempts/{attemptId}/complete', method: 'post' as const, status: '200' },
      { path: '/attempts/{attemptId}/analytics', method: 'get' as const, status: '200' },
      { path: '/users/me/attempts', method: 'get' as const, status: '200' },
      { path: '/users/me/attempts/stats', method: 'get' as const, status: '200' },
    ];

    for (const { path, method, status } of operationsExpectingOk) {
      it(`${method.toUpperCase()} ${path} documents ${status} response`, () => {
        const op = spec.paths[`/api/v1${path}`]?.[method];
        expect(op?.responses).toHaveProperty(status);
      });
    }

    it('POST /attempts/{attemptId}/complete uses 200 (not 201) — Phase 3 audit', () => {
      const op = spec.paths['/api/v1/attempts/{attemptId}/complete']?.post;
      expect(op?.responses).toHaveProperty('200');
      expect(op?.responses).not.toHaveProperty('201');
    });
  });

  // ── 7. Schema integrity for attempt DTOs ────────────────────────────

  describe('attempt response DTOs are registered', () => {
    const requiredDtos = [
      'AttemptResponseDto',
      'AttemptSummaryResponseDto',
      'AttemptListResponseDto',
      'AttemptAnswerResponseDto',
      'AttemptAnswersResponseDto',
      'SubmitAnswerResponseDto',
      'AbandonAttemptResponseDto',
      'CompleteAttemptResponseDto',
      'WithdrawAnswerResponseDto',
      'AttemptAnalyticsResponseDto',
      'UserAttemptStatsResponseDto',
    ];

    for (const dto of requiredDtos) {
      it(`${dto} is present in components.schemas`, () => {
        expect(schemas).toHaveProperty(dto);
      });
    }
  });

  // ── 8. Tagging ─────────────────────────────────────────────────────

  describe('attempt endpoints are tagged correctly', () => {
    for (const path of ATTEMPT_PATHS) {
      const fullPath = `/api/v1${path}`;

      it(`${fullPath} is tagged "attempts"`, () => {
        const pathObj = spec.paths[fullPath] ?? {};
        const httpMethods = Object.keys(pathObj).filter(isHttpMethod);

        expect(httpMethods.length).toBeGreaterThan(0);

        for (const method of httpMethods) {
          const op = pathObj[method];
          expect(op?.tags).toContain('attempts');
        }
      });
    }
  });
});
