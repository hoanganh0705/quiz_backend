/**
 * Unit tests for `QuizResponseMapper` URL derivation.
 *
 * Coverage:
 *   - `imagePublicId` takes precedence over `imageUrl` when set.
 *   - `imagePublicId: null` + `imageUrl: null` returns `null`.
 *   - `imagePublicId` is passed through `STORAGE_PORT.deriveUrl(., 'quiz')`.
 *   - The `author.avatarPublicId` flow uses `STORAGE_PORT.deriveUrl(., 'avatar')`.
 */

import { QuizResponseMapper } from './quiz-response.mapper';
import type { StoragePort } from '@/core/storage/storage.port';
import type { QuizWithPublishedVersionRow } from '../domain/ports/quiz-repository.port';

class FakeStorage implements StoragePort {
  readonly calls: Array<{ publicId: string; purpose: 'avatar' | 'quiz' }> = [];

  upload(): Promise<never> {
    throw new Error('not used');
  }
  delete(): Promise<void> {
    return Promise.resolve();
  }
  deriveUrl(publicId: string, purpose: 'avatar' | 'quiz'): string {
    this.calls.push({ publicId, purpose });
    return `https://cdn.test/${purpose}/${publicId}`;
  }
}

function makeRow(
  overrides: Partial<QuizWithPublishedVersionRow> = {},
): QuizWithPublishedVersionRow {
  return {
    quizId: 'q1',
    creatorId: 'u1',
    title: 'T',
    description: null,
    slug: 't',
    requirements: null,
    imageUrl: null,
    imagePublicId: null,
    categoryId: null,
    isFeatured: false,
    isHidden: false,
    isVerified: false,
    publishedVersionId: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    publishedVersionQuizVersionId: null,
    publishedVersionVersionNumber: null,
    publishedVersionStatus: null,
    publishedVersionDifficulty: null,
    publishedVersionDurationMs: null,
    publishedVersionPassingScorePercent: null,
    publishedVersionRewardXp: null,
    publishedVersionCreatedByUserId: null,
    publishedVersionCreatedAt: null,
    publishedVersionPublishedAt: null,
    publishedVersionArchivedAt: null,
    publishedVersionUpdatedAt: null,
    ...overrides,
  };
}

describe('QuizResponseMapper — URL derivation', () => {
  describe('imageUrl', () => {
    it('prefers imagePublicId (Cloudinary) when set', () => {
      const storage = new FakeStorage();
      const mapper = new QuizResponseMapper(storage);
      const row = makeRow({
        imagePublicId: 'quiz-app/quizzes/u1/abc',
        imageUrl: 'https://legacy.test/cover.png',
      });

      const result = mapper.toQuizResponse(row);

      expect(result.imageUrl).toBe('https://cdn.test/quiz/quiz-app/quizzes/u1/abc');
      expect(storage.calls).toEqual([{ publicId: 'quiz-app/quizzes/u1/abc', purpose: 'quiz' }]);
    });

    it('falls back to legacy imageUrl when imagePublicId is null', () => {
      const storage = new FakeStorage();
      const mapper = new QuizResponseMapper(storage);
      const row = makeRow({
        imagePublicId: null,
        imageUrl: 'https://legacy.test/cover.png',
      });

      const result = mapper.toQuizResponse(row);

      expect(result.imageUrl).toBe('https://legacy.test/cover.png');
      expect(storage.calls).toHaveLength(0);
    });

    it('returns null when both are null', () => {
      const storage = new FakeStorage();
      const mapper = new QuizResponseMapper(storage);
      const row = makeRow({ imagePublicId: null, imageUrl: null });

      const result = mapper.toQuizResponse(row);

      expect(result.imageUrl).toBeNull();
      expect(storage.calls).toHaveLength(0);
    });
  });

  describe('author avatar', () => {
    it('prefers avatarPublicId for the creator avatar', () => {
      const storage = new FakeStorage();
      const mapper = new QuizResponseMapper(storage);
      const row = makeRow();

      const result = mapper.toQuizResponse(row, undefined, [], {
        authorsByUserId: new Map([
          [
            'u1',
            {
              userId: 'u1',
              username: 'alice',
              displayName: 'Alice',
              avatarUrl: 'https://legacy.test/avatar.png',
              avatarPublicId: 'quiz-app/avatars/u1/abc',
            },
          ],
        ]),
      });

      expect(result.creator?.avatarUrl).toBe('https://cdn.test/avatar/quiz-app/avatars/u1/abc');
      expect(storage.calls).toContainEqual({
        publicId: 'quiz-app/avatars/u1/abc',
        purpose: 'avatar',
      });
    });

    it('falls back to avatarUrl when avatarPublicId is null', () => {
      const storage = new FakeStorage();
      const mapper = new QuizResponseMapper(storage);
      const row = makeRow();

      const result = mapper.toQuizResponse(row, undefined, [], {
        authorsByUserId: new Map([
          [
            'u1',
            {
              userId: 'u1',
              username: 'alice',
              displayName: 'Alice',
              avatarUrl: 'https://legacy.test/avatar.png',
              avatarPublicId: null,
            },
          ],
        ]),
      });

      expect(result.creator?.avatarUrl).toBe('https://legacy.test/avatar.png');
    });
  });
});
