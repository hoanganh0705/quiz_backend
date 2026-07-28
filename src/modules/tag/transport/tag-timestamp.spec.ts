/// <reference types="jest" />
/**
 * Phase 1 of the Tag Module API Contract Audit (`docs/api-contract-audit-tag.md`).
 *
 * Verifies that `TagPresenter` produces ISO 8601 timestamps by testing through
 * `ApiResponse.ok()` and `ApiResponse.page()`, which normalize temporal fields
 * before wrapping in the canonical envelope.
 *
 * This mirrors the `envelope.e2e-spec.ts` fixture pattern. It avoids booting
 * the full `TagModule` (which requires Postgres + Redis) and instead tests the
 * presenter + ApiResponse factory directly.
 */
import { TagPresenter } from '@/modules/tag/transport/presenters/tag.presenter';

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Postgres-format strings that should be normalized to ISO 8601
const PG_CREATED_AT = '2026-07-14 00:42:19.472418+00';
const PG_UPDATED_AT = '2026-07-14 00:42:19.472+00';
const PG_FOLLOWED_AT = '2026-06-01 12:00:00.000+00';

const FIXTURE_TAG_RESPONSE = {
  tagId: '019f5e13-1fd1-7ebe-a099-2730ba9bf293',
  name: 'JavaScript',
  slug: 'javascript',
  createdAt: PG_CREATED_AT,
  updatedAt: PG_UPDATED_AT,
};

const FIXTURE_RANKED = {
  ...FIXTURE_TAG_RESPONSE,
  rank: 1,
  totalScore: '980.5',
  totalAttempts: '4200',
};

const FIXTURE_FOLLOWED_ITEM = {
  tagId: '019f5e13-1fd1-7ebe-a099-2730ba9bf293',
  name: 'JavaScript',
  slug: 'javascript',
  followedAt: PG_FOLLOWED_AT,
};

const PAGINATION = {
  kind: 'cursor' as const,
  limit: 20,
  hasNextPage: false,
  nextCursor: null as string | null,
};

describe('TagPresenter — timestamps normalized to ISO 8601 (Phase 1)', () => {
  const presenter = new TagPresenter();

  describe('getTagBySlug (ApiResponse.ok)', () => {
    it('normalizes createdAt and updatedAt to ISO 8601', () => {
      const result = presenter.getTagBySlug(FIXTURE_TAG_RESPONSE);

      expect(result.data.createdAt).toMatch(ISO_8601_REGEX);
      expect(result.data.updatedAt).toMatch(ISO_8601_REGEX);
    });

    it('passes through non-temporal fields unchanged', () => {
      const result = presenter.getTagBySlug(FIXTURE_TAG_RESPONSE);

      expect(result.data.tagId).toBe(FIXTURE_TAG_RESPONSE.tagId);
      expect(result.data.name).toBe(FIXTURE_TAG_RESPONSE.name);
      expect(result.data.slug).toBe(FIXTURE_TAG_RESPONSE.slug);
    });
  });

  describe('createTag (ApiResponse.ok)', () => {
    it('normalizes createdAt and updatedAt to ISO 8601', () => {
      const result = presenter.createTag(FIXTURE_TAG_RESPONSE);

      expect(result.data.createdAt).toMatch(ISO_8601_REGEX);
      expect(result.data.updatedAt).toMatch(ISO_8601_REGEX);
    });
  });

  describe('updateTag (ApiResponse.ok)', () => {
    it('normalizes createdAt and updatedAt to ISO 8601', () => {
      const result = presenter.updateTag(FIXTURE_TAG_RESPONSE);

      expect(result.data.createdAt).toMatch(ISO_8601_REGEX);
      expect(result.data.updatedAt).toMatch(ISO_8601_REGEX);
    });
  });

  describe('restoreTag (ApiResponse.ok)', () => {
    it('normalizes createdAt and updatedAt to ISO 8601', () => {
      const result = presenter.restoreTag(FIXTURE_TAG_RESPONSE);

      expect(result.data.createdAt).toMatch(ISO_8601_REGEX);
      expect(result.data.updatedAt).toMatch(ISO_8601_REGEX);
    });
  });

  describe('getTagAnalytics (ApiResponse.ok)', () => {
    it('normalizes lastUpdated to ISO 8601', () => {
      const analytics = {
        tagId: FIXTURE_TAG_RESPONSE.tagId,
        tagName: FIXTURE_TAG_RESPONSE.name,
        summary: {
          totalQuizzes: 12,
          activeQuizzes: 10,
          totalAttempts: 2480,
          totalPlayers: 920,
          averageScore: 78.4,
          averageRating: 4.6,
        },
        topQuizzes: [],
        lastUpdated: PG_UPDATED_AT,
      };

      const result = presenter.getTagAnalytics(analytics);

      expect(result.data.lastUpdated).toMatch(ISO_8601_REGEX);
    });
  });

  describe('listTags (wrapPaginatedDto — ApiResponse.page)', () => {
    it('normalizes createdAt and updatedAt in every item', () => {
      const result = presenter.listTags({
        items: [
          FIXTURE_TAG_RESPONSE,
          { ...FIXTURE_TAG_RESPONSE, tagId: '019f5e13-1fd1-7eaa-a65b-defe94642216' },
        ],
        pagination: PAGINATION,
      });

      expect(result.data).toHaveLength(2);
      for (const item of result.data) {
        expect(item.createdAt).toMatch(ISO_8601_REGEX);
        expect(item.updatedAt).toMatch(ISO_8601_REGEX);
      }
    });
  });

  describe('listFollowedTags (wrapPaginatedDto — ApiResponse.page)', () => {
    it('normalizes followedAt in every item', () => {
      const result = presenter.listFollowedTags({
        items: [FIXTURE_FOLLOWED_ITEM],
        pagination: PAGINATION,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].followedAt).toMatch(ISO_8601_REGEX);
    });
  });

  describe('getTagQuizzes (wrapPaginatedDto — ApiResponse.page)', () => {
    it('normalizes quiz createdAt and updatedAt to ISO 8601', () => {
      const quizList = {
        items: [
          {
            quizId: '019f5e13-1fd1-7ebe-a099-2730ba9bf293',
            creatorId: null,
            title: 'JS Basics',
            slug: 'js-basics',
            description: null,
            requirements: null,
            imageUrl: null,
            categoryId: null,
            isFeatured: false,
            isHidden: false,
            isVerified: false,
            publishedVersionId: null,
            createdAt: PG_CREATED_AT,
            updatedAt: PG_UPDATED_AT,
            publishedVersion: null,
          },
        ],
        pagination: PAGINATION,
      };

      const result = presenter.getTagQuizzes(quizList);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].createdAt).toMatch(ISO_8601_REGEX);
      expect(result.data[0].updatedAt).toMatch(ISO_8601_REGEX);
      expect(result.meta.pagination).toBeDefined();
      expect(result.meta.timestamp).toMatch(ISO_8601_REGEX);
    });
  });

  describe('getPopularTags (ApiResponse.ok with array)', () => {
    it('normalizes timestamps in ranked tag list', () => {
      const result = presenter.getPopularTags([FIXTURE_RANKED]);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].createdAt).toMatch(ISO_8601_REGEX);
      expect(result.data[0].updatedAt).toMatch(ISO_8601_REGEX);
    });
  });

  describe('getTrendingTags (ApiResponse.ok with array)', () => {
    it('normalizes timestamps in ranked tag list', () => {
      const result = presenter.getTrendingTags([FIXTURE_RANKED]);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].createdAt).toMatch(ISO_8601_REGEX);
      expect(result.data[0].updatedAt).toMatch(ISO_8601_REGEX);
    });
  });

  describe('getRelatedTags (ApiResponse.ok with array)', () => {
    it('normalizes timestamps in related tag list', () => {
      const result = presenter.getRelatedTags([FIXTURE_TAG_RESPONSE]);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].createdAt).toMatch(ISO_8601_REGEX);
      expect(result.data[0].updatedAt).toMatch(ISO_8601_REGEX);
    });
  });

  describe('deleteTag (ApiResponse.ok)', () => {
    it('still returns the message envelope with ISO meta.timestamp', () => {
      const result = presenter.deleteTag({ message: 'Tag deleted successfully' });

      expect(result.data.message).toBe('Tag deleted successfully');
      expect(result.meta.timestamp).toMatch(ISO_8601_REGEX);
    });
  });

  describe('canoncial envelope shape', () => {
    it('every presenter method returns { data, meta: { timestamp, pagination? } }', () => {
      const results = [
        presenter.getTagBySlug(FIXTURE_TAG_RESPONSE),
        presenter.listTags({ items: [FIXTURE_TAG_RESPONSE], pagination: PAGINATION }),
      ];

      for (const result of results) {
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('meta');
        expect(result.meta).toHaveProperty('timestamp');
        expect(result.meta.timestamp).toMatch(ISO_8601_REGEX);
      }
    });
  });
});
