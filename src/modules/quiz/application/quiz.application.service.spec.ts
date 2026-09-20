import { ForbiddenException } from '@nestjs/common';

import { QuizApplicationService } from './quiz.application.service';
import type { StorageApplicationService } from '@/core/storage/application/storage.application.service';
import type { StorageImageLifecycleService } from '@/core/storage/application/storage-image-lifecycle.service';
import type { CreateQuizDto } from '../dto/request/create-quiz.dto';
import type { UpdateQuizDto } from '../dto/request/update-quiz.dto';
import type { QuizQueryService } from '../domain/quiz/quiz-query.service';
import type { QuizCommandService } from '../domain/quiz/quiz-command.service';
import type { QuizAnalyticsService } from '../domain/analytics';
import type { QuizRepositoryPort } from '../domain/ports/quiz-repository.port';
import type { UserDomainService } from '@/modules/user/domain/user.service';
import type { QuizResponseMapper } from '../mappers/quiz-response.mapper';
import type { QuizCacheService } from './quiz-cache.service';
import type { QuizStatsHistoryService } from './quiz-stats-history.service';
import type { QuizAssetOwnershipGuard } from './quiz-asset-ownership.guard';
import type { JwtPayload } from '@/common/guards/jwt.guard';

class FakeStorageOwnership {
  owns = true;
  readonly calls: Array<{ publicId: string; ownerId: string; purpose: 'avatar' | 'quiz' }> = [];

  async userOwnsAssetForPurpose(input: {
    publicId: string;
    ownerId: string;
    purpose: 'avatar' | 'quiz';
  }): Promise<boolean> {
    this.calls.push(input);
    return this.owns;
  }
}

class FakeLifecycleService {
  readonly replaceCalls: Array<{ quizId: string; newPublicId: string | null }> = [];
  readonly deleteCalls: string[] = [];

  async replaceQuizCover(quizId: string, newPublicId: string | null): Promise<void> {
    this.replaceCalls.push({ quizId, newPublicId });
  }
  async deleteQuizCover(quizId: string): Promise<void> {
    this.deleteCalls.push(quizId);
  }

  reset(): void {
    this.replaceCalls.length = 0;
    this.deleteCalls.length = 0;
  }
}

class FakeCommandService {
  readonly createdWith: unknown[] = [];
  readonly updatedWith: unknown[] = [];
  createdRow = {
    quizId: 'q1',
    creatorId: 'u1',
    title: 'My Quiz',
    description: null,
    slug: 'my-quiz',
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
  };
  tags: object[] = [];

  async createQuiz(_user: JwtPayload, command: object) {
    this.createdWith.push(command);
    return { row: this.createdRow, tags: this.tags };
  }
  async updateQuiz(_quizId: string, _user: JwtPayload, command: object) {
    this.updatedWith.push(command);
    return { row: this.createdRow, tags: this.tags };
  }
  async softDeleteQuizById() {
    return { message: 'deleted' };
  }
}

class FakeQueryService {
  buildProjectionContext = async () => ({});
}

function makeService() {
  const ownership = new FakeStorageOwnership();
  const lifecycle = new FakeLifecycleService();
  const commandService = new FakeCommandService();
  const queryService = new FakeQueryService();
  const user = { sub: 'u1' } as JwtPayload;

  const service = new QuizApplicationService(
    queryService as unknown as QuizQueryService,
    commandService as unknown as QuizCommandService,
    {} as unknown as QuizAnalyticsService,
    {} as unknown as UserDomainService,
    {
      findQuizCoverPublicIdById: async () => 'quiz-app/quizzes/u1/old',
      getAuthorSummaries: async () => new Map(),
      getCategorySummaries: async () => new Map(),
      getTagsForQuizIds: async () => new Map(),
      getAggregatesForQuizzes: async () => new Map(),
      getQuestionCountsForVersionIds: async () => new Map(),
    } as unknown as QuizRepositoryPort,
    ownership as unknown as StorageApplicationService,
    lifecycle as unknown as StorageImageLifecycleService,
    {
      getOrSetList: <T>(_key: string, fetcher: () => Promise<T>) => fetcher(),
      getOrSetStats: <T>(_id: string, fetcher: () => Promise<T>) => fetcher(),
      getOrSetProfileBundle: <T>(_id: string, fetcher: () => Promise<T>) => fetcher(),
      invalidateList: async () => undefined,
      invalidateStats: async () => undefined,
      invalidateProfileBundle: async () => undefined,
      buildListCacheKey: ({ filters, cursor, limit }) =>
        `quiz:list:v1:${JSON.stringify({ filters, cursor, limit })}`,
    } as unknown as QuizCacheService,
    {
      countCommentsForQuiz: async () => 0,
      fetchRecentActivity: async () => [],
      fetchHistoryPoints: async () => [],
    } as unknown as QuizStatsHistoryService,
    {
      assertCallerOwnsQuizImage: async (publicId: string | null | undefined) => {
        if (publicId === undefined || publicId === null) return;
        const owns = await ownership.userOwnsAssetForPurpose({
          publicId,
          ownerId: user.sub,
          purpose: 'quiz',
        });
        if (!owns) {
          throw new ForbiddenException({
            code: 'ASSET_NOT_OWNED',
            message: 'not owned',
          });
        }
      },
    } as unknown as QuizAssetOwnershipGuard,
    {
      toQuizResponse: (row: object) => row,
      toListItem: (row: object) => row,
    } as unknown as QuizResponseMapper,
    {
      warn: () => undefined,
      info: () => undefined,
      error: () => undefined,
    } as never,
  );

  return { service, ownership, lifecycle, commandService, user };
}

function makeCreateDto(): CreateQuizDto {
  return {
    title: 'My Quiz',
    slug: 'my-quiz',
    initialVersion: {
      difficulty: 'easy',
      durationMs: 60_000,
      passingScorePercent: 60,
      rewardXp: 10,
    },
  };
}

describe('QuizApplicationService — ownership + lifecycle', () => {
  describe('createQuiz', () => {
    it('rejects an imagePublicId not owned by the caller', async () => {
      const { service, ownership, lifecycle } = makeService();
      ownership.owns = false;
      const dto: CreateQuizDto = {
        ...makeCreateDto(),
        imagePublicId: 'quiz-app/quizzes/u1/stolen',
      };

      await expect(service.createQuiz({ sub: 'u1' } as JwtPayload, dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(ownership.calls).toHaveLength(1);
      expect(lifecycle.replaceCalls).toHaveLength(0);
      expect(lifecycle.deleteCalls).toHaveLength(0);
    });

    it('accepts an imagePublicId owned by the caller', async () => {
      const { service, ownership, commandService } = makeService();
      ownership.owns = true;
      const dto: CreateQuizDto = {
        ...makeCreateDto(),
        imagePublicId: 'quiz-app/quizzes/u1/mine',
      };

      await service.createQuiz({ sub: 'u1' } as JwtPayload, dto);

      expect(ownership.calls).toHaveLength(1);
      expect(ownership.calls[0]?.purpose).toBe('quiz');
      expect(commandService.createdWith).toHaveLength(1);
    });

    it('skips the ownership gate when no publicId is supplied', async () => {
      const { service, ownership } = makeService();
      await service.createQuiz({ sub: 'u1' } as JwtPayload, makeCreateDto());

      expect(ownership.calls).toHaveLength(0);
    });
  });

  describe('updateQuiz', () => {
    it('rejects an imagePublicId not owned by the caller', async () => {
      const { service, ownership } = makeService();
      ownership.owns = false;
      const dto: UpdateQuizDto = {
        imagePublicId: 'quiz-app/quizzes/u1/stolen',
      };

      await expect(
        service.updateQuiz('q1', { sub: 'u1' } as JwtPayload, dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('accepts an imagePublicId owned by the caller and runs lifecycle', async () => {
      const { service, ownership, lifecycle } = makeService();
      ownership.owns = true;
      const dto: UpdateQuizDto = {
        imagePublicId: 'quiz-app/quizzes/u1/mine',
      };

      await service.updateQuiz('q1', { sub: 'u1' } as JwtPayload, dto);

      expect(ownership.calls).toEqual([
        { publicId: 'quiz-app/quizzes/u1/mine', ownerId: 'u1', purpose: 'quiz' },
      ]);
      expect(lifecycle.replaceCalls).toEqual([
        { quizId: 'q1', newPublicId: 'quiz-app/quizzes/u1/mine' },
      ]);
    });

    it('does not call ownership when no publicId is supplied', async () => {
      const { service, ownership, lifecycle } = makeService();
      await service.updateQuiz('q1', { sub: 'u1' } as JwtPayload, {
        title: 'New Title',
      });

      expect(ownership.calls).toHaveLength(0);
      expect(lifecycle.replaceCalls).toHaveLength(1);
    });
  });

  describe('deleteQuiz', () => {
    it('runs lifecycle.deleteQuizCover before soft-deleting the row', async () => {
      const { service, lifecycle, commandService } = makeService();
      lifecycle.reset();
      const before = commandService.createdWith.length;

      await service.deleteQuiz('q1', { sub: 'u1' } as JwtPayload);

      expect(lifecycle.deleteCalls).toEqual(['q1']);
      expect(commandService.createdWith.length).toBe(before);
    });
  });
});
