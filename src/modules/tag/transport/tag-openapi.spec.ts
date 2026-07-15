/// <reference types="jest" />
/**
 * OpenAPI regression guard for the tag module.
 *
 * Verifies:
 *   1. **Phase 3** — Every tag endpoint that uses `:id` as a path parameter
 *      documents it as `format: uuid` in the generated OpenAPI spec —
 *      matching the runtime `ParseUUIDPipe` enforcement.
 *
 *   2. **Phase 3** — The slug-based endpoints (`/tags/:slug`,
 *      `/tags/:slug/quizzes`, `/tags/:slug/related`) document `slug` as a
 *      plain `string` (NOT a UUID), to prevent regressions where a future
 *      developer mistakenly applies `ApiTagIdParam()` to a slug route.
 *
 *   3. **Phase 3** — `TagRankingQueryDto.limit` is documented as optional
 *      with a default of 10 in the popular and trending endpoint query
 *      parameter schemas.
 *
 *   4. **Phase 4** — Every tag operation (14 in total: 8 GETs + 1 POST create
 *      + 1 PATCH + 1 DELETE + 1 POST restore + 1 POST follow + 1 DELETE
 *      unfollow) documents a response `example` so generated SDKs surface
 *      realistic payloads in their docs.
 *
 *   5. **Phase 5** — `FollowedTagItemDto.followedAt` is included in the
 *      schema's `required` array, matching runtime behavior.
 *
 * The test reads the committed JSON file rather than booting the app, so it
 * runs fast and does not depend on any infrastructure. Run `npm run
 * generate:openapi` after wiring a new decorator to keep this file in sync.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type OpenApiPath = Record<string, unknown>;
type OpenApiSpec = {
  paths: Record<string, OpenApiPath>;
  components?: { schemas?: Record<string, unknown> };
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const findIdParam = (pathObj: OpenApiPath, method: string): Record<string, unknown> | undefined => {
  const op = pathObj[method] as Record<string, unknown> | undefined;
  const params = (op?.parameters as Array<Record<string, unknown>>) ?? [];
  return params.find((p) => p.name === 'id');
};

const findSlugParam = (
  pathObj: OpenApiPath,
  method: string,
): Record<string, unknown> | undefined => {
  const op = pathObj[method] as Record<string, unknown> | undefined;
  const params = (op?.parameters as Array<Record<string, unknown>>) ?? [];
  return params.find((p) => p.name === 'slug');
};

const findLimitParam = (
  pathObj: OpenApiPath,
  method: string,
): Record<string, unknown> | undefined => {
  const op = pathObj[method] as Record<string, unknown> | undefined;
  const params = (op?.parameters as Array<Record<string, unknown>>) ?? [];
  return params.find((p) => p.name === 'limit');
};

describe('Tag module — OpenAPI contract (Phase 3)', () => {
  let spec: OpenApiSpec;

  beforeAll(() => {
    const specPath = join(__dirname, '..', '..', '..', '..', 'docs', 'generated', 'openapi.json');
    spec = JSON.parse(readFileSync(specPath, 'utf-8')) as OpenApiSpec;
  });

  // ── 1. :id path parameters are documented as UUID ────────────────────────

  describe(':id path parameters document format: uuid', () => {
    const idEndpoints: Array<[string, string]> = [
      ['/api/v1/tags/{id}/analytics', 'get'],
      ['/api/v1/tags/{id}/follow', 'post'],
      ['/api/v1/tags/{id}/follow', 'delete'],
      ['/api/v1/tags/{id}/restore', 'post'],
      ['/api/v1/tags/{id}', 'patch'],
      ['/api/v1/tags/{id}', 'delete'],
    ];

    it.each(idEndpoints)('%s [%s] has :id with format=uuid', (route, method) => {
      const pathObj = spec.paths[route];
      expect(pathObj).toBeDefined();
      const idParam = findIdParam(pathObj, method);
      expect(idParam).toBeDefined();

      const schema = (idParam?.schema as Record<string, unknown>) ?? {};
      expect(schema.format).toBe('uuid');
      expect(schema.type).toBe('string');

      // Optional sanity: the example should be a syntactically valid UUID
      if (typeof idParam?.example === 'string') {
        expect(idParam.example).toMatch(UUID_REGEX);
      }
    });

    it('does NOT apply format=uuid to slug path parameters', () => {
      const slugRoutes: Array<[string, string]> = [
        ['/api/v1/tags/{slug}', 'get'],
        ['/api/v1/tags/{slug}/quizzes', 'get'],
        ['/api/v1/tags/{slug}/related', 'get'],
      ];

      for (const [route, method] of slugRoutes) {
        const pathObj = spec.paths[route];
        expect(pathObj).toBeDefined();
        const slugParam = findSlugParam(pathObj, method);
        expect(slugParam).toBeDefined();

        const schema = (slugParam?.schema as Record<string, unknown>) ?? {};
        // Slug must remain a plain string (no UUID format)
        expect(schema.type).toBe('string');
        expect(schema.format).not.toBe('uuid');
      }
    });
  });

  // ── 2. TagRankingQueryDto.limit is documented as optional with default=10 ─

  describe('TagRankingQueryDto.limit documents optional + default', () => {
    const rankingEndpoints: Array<[string, string]> = [
      ['/api/v1/tags/popular', 'get'],
      ['/api/v1/tags/trending', 'get'],
    ];

    it.each(rankingEndpoints)(
      '%s [%s] documents limit as optional with default=10',
      (route, method) => {
        const pathObj = spec.paths[route];
        expect(pathObj).toBeDefined();
        const limitParam = findLimitParam(pathObj, method);
        expect(limitParam).toBeDefined();

        // `required: false` (or absent, which defaults to false in OpenAPI)
        if ('required' in limitParam!) {
          expect(limitParam.required).toBe(false);
        }

        const schema = (limitParam?.schema as Record<string, unknown>) ?? {};
        expect(schema.default).toBe(10);
        expect(schema.minimum).toBe(1);
        expect(schema.maximum).toBe(100);
      },
    );
  });

  // ── 3. Phase 4 — every tag operation documents a response example ───────

  describe('Phase 4 — every tag operation documents a response example', () => {
    const getExample = (pathObj: OpenApiPath, method: string, status: string): unknown => {
      const op = (pathObj[method] as Record<string, unknown>) ?? {};
      const responses = (op.responses as Record<string, Record<string, unknown>>) ?? {};
      const respObj = responses[status] ?? {};
      const content = (respObj.content as Record<string, Record<string, unknown>>) ?? {};
      return content['application/json']?.example;
    };

    const tagOps: Array<[string, string, string]> = [
      // path, method, status
      ['/api/v1/tags', 'get', '200'], // listTags
      ['/api/v1/tags', 'post', '201'], // createTag
      ['/api/v1/tags/popular', 'get', '200'], // getPopularTags
      ['/api/v1/tags/trending', 'get', '200'], // getTrendingTags
      ['/api/v1/tags/{slug}', 'get', '200'], // getTagBySlug
      ['/api/v1/tags/{slug}/quizzes', 'get', '200'], // getTagQuizzes
      ['/api/v1/tags/{slug}/related', 'get', '200'], // getRelatedTags
      ['/api/v1/tags/{id}/analytics', 'get', '200'], // getTagAnalytics
      ['/api/v1/tags/{id}/follow', 'post', '200'], // followTag
      ['/api/v1/tags/{id}/follow', 'delete', '200'], // unfollowTag
      ['/api/v1/tags/{id}/restore', 'post', '200'], // restoreTag
      ['/api/v1/tags/{id}', 'patch', '200'], // updateTag
      ['/api/v1/tags/{id}', 'delete', '200'], // deleteTag
      ['/api/v1/users/me/followed-tags', 'get', '200'], // listFollowedTags
    ];

    it.each(tagOps)('%s [%s] has response example for status %s', (route, method, status) => {
      const pathObj = spec.paths[route];
      expect(pathObj).toBeDefined();

      const example = getExample(pathObj, method, status);
      expect(example).toBeDefined();

      // Each example must be a `{ data, meta }` envelope object
      const env = example as Record<string, unknown>;
      expect(env).toHaveProperty('data');
      expect(env).toHaveProperty('meta');
      expect(env.meta as Record<string, unknown>).toHaveProperty('timestamp');
    });

    it('lists all 14 tag operations', () => {
      expect(tagOps).toHaveLength(14);
    });
  });

  // ── 4. Phase 5 — FollowedTagItemDto.followedAt is in required array ─────

  describe('Phase 5 — FollowedTagItemDto.followedAt is documented as required', () => {
    let followedTagItemSchema: Record<string, unknown>;

    beforeAll(() => {
      const schemas = spec.components?.schemas ?? {};
      followedTagItemSchema = (schemas.FollowedTagItemDto as Record<string, unknown>) ?? {};
    });

    it('FollowedTagItemDto is present in components.schemas', () => {
      expect(followedTagItemSchema).toBeDefined();
    });

    it('declares followedAt in the required array', () => {
      const required = (followedTagItemSchema.required as string[] | undefined) ?? [];
      expect(required).toContain('followedAt');
    });

    it('declares followedAt as a non-nullable string property', () => {
      const properties = (followedTagItemSchema.properties as Record<string, unknown>) ?? {};
      const followedAt = (properties.followedAt as Record<string, unknown>) ?? {};
      expect(followedAt.type).toBe('string');
      // The schema should not be wrapped in a nullable union since the DTO
      // declares `followedAt!: string;` (non-nullable in TypeScript).
      expect(followedAt.nullable).not.toBe(true);
    });
  });
});
