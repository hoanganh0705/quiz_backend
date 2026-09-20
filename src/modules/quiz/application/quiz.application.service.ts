import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QuizAnalyticsService } from '../domain/analytics';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizQueryService } from '../domain/quiz/quiz-query.service';
import { QuizCommandService } from '../domain/quiz/quiz-command.service';
import {
  QuizResponseMapper,
  QuizQuestionPlayerResponseMapper,
  QuizStatsResponseMapper,
  type QuizProjectionContext,
} from '../mappers';
import { CreatorQuizAnalyticsResponseMapper } from '../mappers/creator-quiz-analytics-response.mapper';
import { QuizCursorMapper } from '../mappers/quiz-cursor.mapper';
import { CreateQuizDto } from '../dto/request/create-quiz.dto';
import { UpdateQuizDto } from '../dto/request/update-quiz.dto';
import { FeaturedQuizzesQueryDto } from '../dto/request/featured-quizzes-query.dto';
import { RecommendedQuizzesQueryDto } from '../dto/request/recommended-quizzes-query.dto';
import { ListQuizzesQueryDto } from '../dto/request/list-quizzes-query.dto';
import { QuizStatsHistoryQueryDto } from '../dto/request/quiz-stats-history-query.dto';
import type { QuizResponseDto } from '../dto/response/quiz-response.dto';
import type { QuizListResponseDto } from '../dto/response/quiz-list-response.dto';
import type { QuizStatsResponseDto } from '../dto/response/quiz-stats-response.dto';
import type { QuizPreviewResponseDto } from '../dto/response/quiz-preview-response.dto';
import type { QuizStatsHistoryResponseDto } from '../dto/response/quiz-stats-history-response.dto';
import type { QuizAggregateResponseDto } from '../dto/response/quiz-aggregate-response.dto';
import type { QuizListingPort } from '../domain/analytics/ports/quiz-listing.port';
import type {
  CreatorQuizAnalyticsDto,
  PopularQuizItemDto,
  TrendingQuizItemDto,
} from '../dto/response/quiz-analytics.dto';
import type { RelatedQuizzesResponseDto } from '../dto/response/related-quizzes-response.dto';
import type { DeleteQuizResponseDto } from '../dto/response/delete-quiz-response.dto';
import type { CreateQuizCommand, RelatedQuizzesQuery, UpdateQuizCommand } from '../domain/types';
import type { QuizDifficulty } from '../types/quiz.types';
import { USER_DOMAIN_SERVICE, type UserDomainService } from '@/modules/user/domain/user.service';
import {
  QUIZ_REPOSITORY_PORT,
  type QuizRepositoryPort,
} from '../domain/ports/quiz-repository.port';
import { StorageApplicationService } from '@/core/storage/application/storage.application.service';
import { StorageImageLifecycleService } from '@/core/storage/application/storage-image-lifecycle.service';
import { QuizCacheService } from './quiz-cache.service';
import { QuizStatsHistoryService } from './quiz-stats-history.service';
import { QuizAssetOwnershipGuard } from './quiz-asset-ownership.guard';

@Injectable()
export class QuizApplicationService implements QuizListingPort {
  constructor(
    private readonly quizQueryService: QuizQueryService,
    private readonly quizCommandService: QuizCommandService,
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @Inject(USER_DOMAIN_SERVICE)
    private readonly userDomainService: UserDomainService,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: QuizRepositoryPort,
    private readonly storageOwnership: StorageApplicationService,
    private readonly storageLifecycle: StorageImageLifecycleService,
    private readonly quizCache: QuizCacheService,
    private readonly quizStatsHistory: QuizStatsHistoryService,
    private readonly assetOwnership: QuizAssetOwnershipGuard,
    private readonly quizMapper: QuizResponseMapper,
    @InjectPinoLogger(QuizApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  private async buildProjectionContext(
    rows: readonly {
      quizId: string;
      creatorId: string | null;
      categoryId: string | null;
      publishedVersionQuizVersionId: string | null;
    }[],
  ): Promise<QuizProjectionContext> {
    const quizIds = rows.map((r) => r.quizId);
    const creatorIds = Array.from(
      new Set(rows.map((r) => r.creatorId).filter((v): v is string => v !== null)),
    );
    const categoryIds = Array.from(
      new Set(rows.map((r) => r.categoryId).filter((v): v is string => v !== null)),
    );
    const versionIds = Array.from(
      new Set(
        rows.map((r) => r.publishedVersionQuizVersionId).filter((v): v is string => v !== null),
      ),
    );

    const [
      authorsByUserId,
      categoriesById,
      tagsByQuizId,
      aggregatesByQuizId,
      questionCountByVersionId,
    ] = await Promise.all([
      this.quizRepository.getAuthorSummaries(creatorIds),
      this.quizRepository.getCategorySummaries(categoryIds),
      this.quizRepository.getTagsForQuizIds(quizIds),
      this.quizRepository.getAggregatesForQuizzes(quizIds),
      this.quizRepository.getQuestionCountsForVersionIds(versionIds),
    ]);

    return {
      authorsByUserId,
      categoriesById,
      tagsByQuizId,
      aggregatesByQuizId,
      questionCountByVersionId,
    };
  }

  async createQuiz(user: JwtPayload, dto: CreateQuizDto): Promise<QuizResponseDto> {
    await this.assetOwnership.assertCallerOwnsQuizImage(dto.imagePublicId, user);

    const command: CreateQuizCommand = {
      creatorId: user.sub,
      title: dto.title,
      slug: dto.slug as string,
      description: dto.description ?? null,
      requirements: dto.requirements ?? null,
      imageUrl: dto.imageUrl ?? null,
      imagePublicId: dto.imagePublicId ?? null,
      isFeatured: dto.isFeatured ?? false,
      isHidden: dto.isHidden ?? false,
      initialVersion: dto.initialVersion,
      categoryId: dto.categoryId ?? null,
      tagIds: dto.tagIds ?? [],
    };
    const { row, tags } = await this.quizCommandService.createQuiz(user, command);
    const context = await this.buildProjectionContext([row]);
    return this.quizMapper.toQuizResponse(row, undefined, tags, context);
  }

  async listQuizzes(dto: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = dto.cursor ? QuizCursorMapper.parse(dto.cursor) : null;

    const cacheKey = this.quizCache.buildListCacheKey({
      filters: {
        difficulty: dto.difficulty,
        categoryId: dto.categoryId,
        tagIds: dto.tagIds,
        q: dto.q,
        sort: dto.sort,
        isHidden: dto.isHidden,
        minRating: dto.minRating,
      },
      cursor,
      limit,
    });

    const result = await this.quizCache.getOrSetList(cacheKey, () =>
      this.quizQueryService.listQuizzes({
        limit,
        cursor,
        filters: {
          difficulty: dto.difficulty as QuizDifficulty,
          categoryId: dto.categoryId,
          tagIds: dto.tagIds,
          q: dto.q,
          sort: dto.sort,
          isHidden: dto.isHidden,
          minRating: dto.minRating,
        },
      }),
    );

    const context = await this.buildProjectionContext(result.items);
    return {
      items: result.items.map((row) => this.quizMapper.toListItem(row, context)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getFeaturedQuizzes(query: FeaturedQuizzesQueryDto): Promise<RelatedQuizzesResponseDto> {
    const items = await this.quizQueryService.getFeaturedQuizzes({
      limit: query.limit ?? 10,
    });

    const context = await this.buildProjectionContext(items);
    return {
      items: items.map((item) => this.quizMapper.toListItem(item, context)),
    };
  }

  async getRecommendedQuizzes(
    userId: string,
    query: RecommendedQuizzesQueryDto,
  ): Promise<RelatedQuizzesResponseDto> {
    const items = await this.quizQueryService.getRecommendedQuizzes(userId, {
      limit: query.limit ?? 20,
    });

    const context = await this.buildProjectionContext(items);
    return {
      items: items.map((item) => this.quizMapper.toListItem(item, context)),
    };
  }

  async getQuizById(quizId: string): Promise<QuizResponseDto> {
    const { row, questions, tags } = await this.quizQueryService.getQuizById(quizId);
    const context = await this.buildProjectionContext([row]);
    const mappedQuestions = questions
      ? QuizQuestionPlayerResponseMapper.toPlayerQuestionResponses(questions)
      : undefined;
    return this.quizMapper.toQuizResponse(row, mappedQuestions, tags, context);
  }

  async getQuizBySlug(slug: string): Promise<QuizResponseDto> {
    const { row, questions, tags } = await this.quizQueryService.getQuizBySlug(slug);
    const context = await this.buildProjectionContext([row]);
    const mappedQuestions = questions
      ? QuizQuestionPlayerResponseMapper.toPlayerQuestionResponses(questions)
      : undefined;
    return this.quizMapper.toQuizResponse(row, mappedQuestions, tags, context);
  }

  async getQuizStats(quizId: string | undefined, slug: string): Promise<QuizStatsResponseDto> {
    const resolveQuizId = async (): Promise<string> => {
      if (quizId) return quizId;
      const resolved = await this.quizQueryService.getQuizStats(undefined, slug);
      return resolved.quizId;
    };

    const resolvedQuizId = await resolveQuizId();

    return this.quizCache.getOrSetStats(resolvedQuizId, async () => {
      const stats = await this.quizQueryService.getQuizStats(quizId, slug);
      const [commentsCount, recentActivity] = await Promise.all([
        this.quizStatsHistory.countCommentsForQuiz(stats.quizId),
        this.quizStatsHistory.fetchRecentActivity(stats.quizId, 30),
      ]);
      return QuizStatsResponseMapper.toResponse(stats, { commentsCount, recentActivity });
    });
  }

  async getQuizStatsHistory(
    quizId: string | undefined,
    slug: string,
    query: QuizStatsHistoryQueryDto,
  ): Promise<QuizStatsHistoryResponseDto> {
    const stats = await this.quizQueryService.getQuizStats(quizId, slug);
    const points = await this.quizStatsHistory.fetchHistoryPoints(
      stats.quizId,
      query.range ?? '30d',
      query.bucket ?? 'day',
    );
    return {
      quizId: stats.quizId,
      range: query.range ?? '30d',
      bucket: query.bucket ?? 'day',
      points,
    };
  }

  async getQuizPreview(
    quizIdOrSlug: string,
    previewSize = PREVIEW_QUESTION_COUNT,
  ): Promise<QuizPreviewResponseDto> {
    const resolvedQuizId = isUuid(quizIdOrSlug) ? quizIdOrSlug : undefined;
    const normalizedSlug = isUuid(quizIdOrSlug) ? undefined : quizIdOrSlug;

    // Resolve the quiz through the same path as `getQuizStats` so
    // we honour the UUID-or-slug contract end-to-end.
    const result = normalizedSlug
      ? await this.quizQueryService.getQuizBySlug(normalizedSlug)
      : await this.quizQueryService.getQuizById(resolvedQuizId as string);

    const { row, questions } = result;
    const totalQuestions = row.publishedVersionQuizVersionId
      ? ((
          await this.quizRepository.getQuestionCountsForVersionIds([
            row.publishedVersionQuizVersionId,
          ])
        ).get(row.publishedVersionQuizVersionId) ?? 0)
      : 0;

    if (!row.publishedVersionQuizVersionId || !questions || questions.length === 0) {
      return {
        quizId: row.quizId,
        publishedVersionId: row.publishedVersionId,
        questions: [],
        totalQuestions,
      };
    }

    const previewQuestions = QuizQuestionPlayerResponseMapper.toPlayerQuestionResponses(
      questions.slice(0, previewSize),
    );

    return {
      quizId: row.quizId,
      publishedVersionId: row.publishedVersionId,
      questions: previewQuestions,
      totalQuestions,
    };
  }

  async getQuizAggregate(quizIdOrSlug: string): Promise<QuizAggregateResponseDto> {
    const isUuidValue = isUuid(quizIdOrSlug);
    const quizId = isUuidValue ? quizIdOrSlug : undefined;
    const slug = isUuidValue ? undefined : quizIdOrSlug;

    const [quiz, stats, statsHistory, preview] = await Promise.all([
      slug ? this.getQuizBySlug(slug) : this.getQuizById(quizId as string),
      this.getQuizStats(quizId, quizIdOrSlug),
      this.getQuizStatsHistory(quizId, quizIdOrSlug, {}),
      this.getQuizPreview(quizIdOrSlug),
    ]);

    return {
      quiz,
      stats,
      statsHistory,
      previewQuestions: preview.questions,
    };
  }

  async getRelatedQuizzes(
    slug: string,
    query: RelatedQuizzesQuery,
  ): Promise<RelatedQuizzesResponseDto> {
    const items = await this.quizQueryService.getRelatedQuizzes(slug, query);

    const context = await this.buildProjectionContext(items);
    return {
      items: items.map((item) => this.quizMapper.toListItem(item, context)),
    };
  }

  async listQuizzesByCreator(
    userId: string,
    dto: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = dto.cursor ? QuizCursorMapper.parse(dto.cursor) : null;

    const result = await this.quizQueryService.listQuizzes({
      limit,
      cursor,
      filters: {
        creatorId: userId,
      },
    });

    const context = await this.buildProjectionContext(result.items);
    return {
      items: result.items.map((row) => this.quizMapper.toListItem(row, context)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async listMyQuizzes(userId: string, dto: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = dto.cursor ? QuizCursorMapper.parse(dto.cursor) : null;

    const result = await this.quizQueryService.listUserQuizzes(userId, {
      limit,
      cursor,
      filters: {
        difficulty: dto.difficulty as QuizDifficulty,
        categoryId: dto.categoryId,
        tagIds: dto.tagIds,
        q: dto.q,
        sort: dto.sort,
        minRating: dto.minRating,
      },
    });

    const context = await this.buildProjectionContext(result.items);
    return {
      items: result.items.map((row) => this.quizMapper.toListItem(row, context)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async listMyDraftQuizzes(userId: string, dto: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = dto.cursor ? QuizCursorMapper.parse(dto.cursor) : null;

    const result = await this.quizQueryService.listDraftQuizzes(userId, {
      limit,
      cursor,
      filters: {
        difficulty: dto.difficulty as QuizDifficulty,
        categoryId: dto.categoryId,
        tagIds: dto.tagIds,
        q: dto.q,
        sort: dto.sort,
        minRating: dto.minRating,
      },
    });

    const context = await this.buildProjectionContext(result.items);
    return {
      items: result.items.map((row) => this.quizMapper.toListItem(row, context)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async listMyPublishedQuizzes(
    userId: string,
    dto: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = dto.cursor ? QuizCursorMapper.parse(dto.cursor) : null;

    const result = await this.quizQueryService.listPublishedQuizzes(userId, {
      limit,
      cursor,
      filters: {
        difficulty: dto.difficulty as QuizDifficulty,
        categoryId: dto.categoryId,
        tagIds: dto.tagIds,
        q: dto.q,
        sort: dto.sort,
        minRating: dto.minRating,
      },
    });

    const context = await this.buildProjectionContext(result.items);
    return {
      items: result.items.map((row) => this.quizMapper.toListItem(row, context)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getTrendingQuizzes(limit: number, categoryId?: string): Promise<TrendingQuizItemDto[]> {
    const quizzes = await this.quizAnalyticsService.getTrendingQuizzes(limit, categoryId);

    return quizzes.map((q) => ({
      rank: q.rank,
      quizId: q.quizId,
      creatorId: q.creatorId,
      title: q.title,
      slug: q.slug,
      imageUrl: q.imageUrl,
      trendingScore: q.trendingScore,
      totalAttempts: q.totalAttempts,
      recentAttempts: q.recentAttempts,
    }));
  }

  async getPopularQuizzes(limit: number, categoryId?: string): Promise<PopularQuizItemDto[]> {
    const quizzes = await this.quizAnalyticsService.getPopularQuizzes(limit, categoryId);

    return quizzes.map((q) => ({
      rank: q.rank,
      quizId: q.quizId,
      creatorId: q.creatorId,
      title: q.title,
      slug: q.slug,
      imageUrl: q.imageUrl,
      popularityScore: q.popularityScore,
      totalAttempts: q.totalAttempts,
      averageRating: q.averageRating,
      bookmarkCount: q.bookmarkCount,
    }));
  }

  async getMyQuizAnalytics(userId: string): Promise<CreatorQuizAnalyticsDto> {
    await this.userDomainService.getMe(userId);
    const analytics = await this.quizQueryService.getCreatorAnalytics(userId);
    return CreatorQuizAnalyticsResponseMapper.toResponse(analytics);
  }

  async updateQuiz(quizId: string, user: JwtPayload, dto: UpdateQuizDto): Promise<QuizResponseDto> {
    await this.assetOwnership.assertCallerOwnsQuizImage(dto.imagePublicId, user);

    const command: UpdateQuizCommand = {
      title: dto.title,
      description: dto.description,
      slug: dto.slug,
      requirements: dto.requirements,
      imageUrl: dto.imageUrl,
      imagePublicId: dto.imagePublicId,
      isFeatured: dto.isFeatured,
      isHidden: dto.isHidden,
      categoryId: dto.categoryId,
      tagIds: dto.tagIds,
    };
    const { row, tags } = await this.quizCommandService.updateQuiz(quizId, user, command);

    const newPublicId = dto.imagePublicId !== undefined ? dto.imagePublicId : row.imagePublicId;
    try {
      await this.storageLifecycle.replaceQuizCover(quizId, newPublicId, (id) =>
        this.quizRepository.findQuizCoverPublicIdById(id),
      );
    } catch (err) {
      this.logger.warn({
        event: 'storage_lifecycle_unexpected_error',
        quizId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    const context = await this.buildProjectionContext([row]);
    return this.quizMapper.toQuizResponse(row, undefined, tags, context);
  }

  async deleteQuiz(quizId: string, user: JwtPayload): Promise<DeleteQuizResponseDto> {
    // Order of operations matters:
    //   1. Snapshot the current cover `imagePublicId` while the quiz
    //      row is still visible (so the cover-delete callback can find
    //      it).
    //   2. Soft-delete the quiz row. If this fails, we never deleted
    //      the cover — the quiz remains live and intact.
    //   3. Best-effort cover delete. If this fails, the quiz is
    //      already marked deleted, so a future sweep can re-collect the
    //      orphan cover from Cloudinary.
    //
    // The previous order (cover-delete → soft-delete) inverted this:
    // a cover-delete success followed by a soft-delete failure would
    // leave a live quiz with no cover image — visible to readers as a
    // broken `<img>`.
    const coverPublicId = await this.quizRepository.findQuizCoverPublicIdById(quizId);
    const result = await this.quizCommandService.softDeleteQuizById(quizId, user);

    if (coverPublicId) {
      try {
        // The callback only needs to return the previously-snapshotted
        // publicId — the lifecycle service uses it as the asset to
        // delete. Wrap in an `async` so the signature
        // `(quizId: string) => Promise<string | null>` is honoured.
        await this.storageLifecycle.deleteQuizCover(quizId, async () =>
          Promise.resolve(coverPublicId),
        );
      } catch (err) {
        this.logger.warn({
          event: 'storage_lifecycle_unexpected_error',
          quizId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }

  async listQuizzesByTag(params: {
    tagIds: string[];
    dto: ListQuizzesQueryDto;
  }): Promise<QuizListResponseDto> {
    return this.listQuizzes({ ...params.dto, tagIds: params.tagIds });
  }
}

const PREVIEW_QUESTION_COUNT = 2;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
