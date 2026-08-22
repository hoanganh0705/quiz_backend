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
import { commentRows } from '@/core/database/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import type { QuizStatsHistoryPointDto } from '../dto/response/quiz-stats-history-point.dto';
import { StorageApplicationService } from '@/core/storage/application/storage.application.service';
import { StorageImageLifecycleService } from '@/core/storage/application/storage-image-lifecycle.service';
import { QuizCacheService } from './quiz-cache.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

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
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly storageOwnership: StorageApplicationService,
    private readonly storageLifecycle: StorageImageLifecycleService,
    private readonly quizCache: QuizCacheService,
    private readonly quizMapper: QuizResponseMapper,
    @InjectPinoLogger(QuizApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Phase 2 (S-6 / S-7 / S-8): build the batched projection context
   * for a page of `QuizWithPublishedVersionRow`s. Five concurrent
   * queries (creators / categories / tags / aggregates / question
   * counts) keyed off the page. The mapper stitches the result
   * onto each item, so a page of 20 quizzes resolves with one
   * `list*` query plus five batched lookups — never 1 + 4×N.
   */
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
    if (dto.imagePublicId !== undefined && dto.imagePublicId !== null) {
      const owns = await this.storageOwnership.userOwnsAssetForPurpose({
        publicId: dto.imagePublicId,
        ownerId: user.sub,
        purpose: 'quiz',
      });
      if (!owns) {
        throw new ForbiddenException({
          code: 'ASSET_NOT_OWNED',
          message:
            'The supplied cover image publicId is not owned by the authenticated user for the quiz cover purpose.',
        });
      }
    }

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

    // Phase 3 #1: read-through cache for the public list page.
    // The cache key is derived from the (filters, cursor, limit)
    // tuple so every distinct page has its own entry. Invalidation
    // is centralised in `invalidateListCacheHandler` and fired on
    // every `QuizCreatedEvent` / `QuizUpdatedEvent` / `QuizDeletedEvent`.
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
    // Phase 3 #2: cache the resolved stats per quizId. The slug
    // lookup is wrapped in a closure so the cache stores the
    // mapped DTO by quizId, not by slug. Two callers hitting
    // `/quizzes/<slug>/stats` and `/quizzes/<uuid>/stats` end up
    // pointing at the same cache entry.
    const resolveQuizId = async (): Promise<string> => {
      if (quizId) return quizId;
      const resolved = await this.quizQueryService.getQuizStats(undefined, slug);
      return resolved.quizId;
    };

    const resolvedQuizId = await resolveQuizId();

    return this.quizCache.getOrSetStats(resolvedQuizId, async () => {
      const stats = await this.quizQueryService.getQuizStats(quizId, slug);
      const [commentsCount, recentActivity] = await Promise.all([
        this.countCommentsForQuiz(stats.quizId),
        this.fetchRecentActivity(stats.quizId, 30),
      ]);
      return QuizStatsResponseMapper.toResponse(stats, { commentsCount, recentActivity });
    });
  }

  /**
   * Phase 2 (S-11): sparkline data for `GET /quizzes/:id/stats/history`.
   * The route accepts `?range=7d|30d&bucket=day|hour`; the response is
   * densified server-side so the client renders a continuous chart.
   */
  async getQuizStatsHistory(
    quizId: string | undefined,
    slug: string,
    query: QuizStatsHistoryQueryDto,
  ): Promise<QuizStatsHistoryResponseDto> {
    const stats = await this.quizQueryService.getQuizStats(quizId, slug);
    const points = await this.fetchHistoryPoints(
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

  /**
   * Phase 2 (S-9): public preview of a quiz. Returns the first
   * `previewSize` questions of the published version with the
   * `isCorrect` flag stripped. `@Public()` so deep-link previews
   * from social/sharing surfaces work without a session.
   */
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

  /**
   * Phase 4 (S-24): bundle for the quiz detail page. Replaces
   * the 5+ sequential calls with a single parallelised fan-out.
   *
   * The bundle shape is `QuizAggregateResponseDto`:
   *   - `quiz`             — full quiz record (with published version)
   *   - `stats`            — quiz stats (cached counter snapshot)
   *   - `statsHistory`     — bucketed stats timeline (sparkline)
   *   - `previewQuestions` — first N questions (player-style)
   */
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
      creatorId: null, // TODO: Populate when analytics queries include creatorId
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
      creatorId: null, // TODO: Populate when analytics queries include creatorId
      title: q.title,
      slug: q.slug,
      imageUrl: q.imageUrl,
      popularityScore: q.popularityScore,
      totalAttempts: q.totalAttempts,
      averageRating: q.averageRating,
      bookmarkCount: q.bookmarkCount,
    }));
  }

  /**
   * Phase 2.3 (H3): Asserts the user exists before returning analytics.
   * `userDomainService.getMe` throws `UserNotFoundError` → 404 if the user
   * does not exist, restoring the documented contract for this endpoint.
   */
  async getMyQuizAnalytics(userId: string): Promise<CreatorQuizAnalyticsDto> {
    await this.userDomainService.getMe(userId);
    const analytics = await this.quizQueryService.getCreatorAnalytics(userId);
    return CreatorQuizAnalyticsResponseMapper.toResponse(analytics);
  }

  async updateQuiz(quizId: string, user: JwtPayload, dto: UpdateQuizDto): Promise<QuizResponseDto> {
    if (dto.imagePublicId !== undefined && dto.imagePublicId !== null) {
      const owns = await this.storageOwnership.userOwnsAssetForPurpose({
        publicId: dto.imagePublicId,
        ownerId: user.sub,
        purpose: 'quiz',
      });
      if (!owns) {
        throw new ForbiddenException({
          code: 'ASSET_NOT_OWNED',
          message:
            'The supplied cover image publicId is not owned by the authenticated user for the quiz cover purpose.',
        });
      }
    }

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
    try {
      await this.storageLifecycle.deleteQuizCover(quizId, (id) =>
        this.quizRepository.findQuizCoverPublicIdById(id),
      );
    } catch (err) {
      this.logger.warn({
        event: 'storage_lifecycle_unexpected_error',
        quizId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return this.quizCommandService.softDeleteQuizById(quizId, user);
  }

  async listQuizzesByTag(params: {
    tagIds: string[];
    dto: ListQuizzesQueryDto;
  }): Promise<QuizListResponseDto> {
    return this.listQuizzes({ ...params.dto, tagIds: params.tagIds });
  }

  // ─── Phase 2 helpers ───────────────────────────────────────────────────

  /**
   * Phase 2 (S-10): counts non-deleted comments attached to the
   * quiz. Counts both top-level comments and replies (the audit
   * recommendation) so the stats panel's "Comments" counter stays
   * in sync with what `/comments` paginated list would return.
   */
  private async countCommentsForQuiz(quizId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(commentRows)
      .where(and(eq(commentRows.quizId, quizId), isNull(commentRows.deletedAt)));
    return Number(row?.count ?? 0);
  }

  /**
   * Phase 2 (S-10): 30-day attempt timeline for the stats panel
   * sparkline. Bucketed by day; gaps are densified to zero so the
   * client can render a continuous timeline without further math.
   */
  private async fetchRecentActivity(
    quizId: string,
    days: number,
  ): Promise<QuizStatsHistoryPointDto[]> {
    return this.fetchHistoryPoints(quizId, days === 7 ? '7d' : '30d', 'day');
  }

  /**
   * Phase 2 (S-11): sparkline history endpoint backing store.
   * Bucketed timeline with `range` and `bucket` parameters from
   * the `QuizStatsHistoryQueryDto`. Gaps are densified to zero so
   * the client renders a continuous chart.
   *
   * Note: this method runs two queries — the actual bucket reads
   * and a `generate_series` densification. The latter runs against
   * the system catalog (no real data), so it's cheap; the heavy
   * work is the bucket read.
   */
  private async fetchHistoryPoints(
    quizId: string,
    range: '7d' | '30d',
    bucket: 'day' | 'hour',
  ): Promise<QuizStatsHistoryPointDto[]> {
    const days = range === '7d' ? 7 : 30;
    const bucketColumn = bucket === 'hour' ? 'hour' : 'day';

    // 1. Pull attempts joined to this quiz's versions, bucketed by
    //    `bucketColumn`. We use `started_at` for attempts and
    //    `completed_at` for completions, treating NULLs with COALESCE.
    const attempts = await this.db.execute(sql`
      WITH version_ids AS (
        SELECT quiz_version_id FROM quiz_versions WHERE quiz_id = ${quizId}
      )
      SELECT
        date_trunc(${bucketColumn}, quiz_attempts.started_at) AS bucket_start,
        COUNT(*)::int AS attempts,
        COUNT(*) FILTER (WHERE quiz_attempts.status = 'completed')::int AS completions,
        COUNT(DISTINCT quiz_attempts.user_id)::int AS unique_players
      FROM quiz_attempts
      WHERE quiz_attempts.quiz_version_id IN (SELECT quiz_version_id FROM version_ids)
        AND quiz_attempts.started_at >= NOW() - (${days} || ' days')::interval
      GROUP BY 1
    `);

    type BucketRow = {
      bucket_start: Date | string;
      attempts: number;
      completions: number;
      unique_players: number;
    };

    const rawRows = (attempts as unknown as { rows?: BucketRow[] }).rows ?? [];

    const buckets = new Map<
      string,
      { attempts: number; completions: number; uniquePlayers: number }
    >();
    for (const r of rawRows) {
      const key = formatBucketKey(new Date(r.bucket_start), bucket);
      buckets.set(key, {
        attempts: Number(r.attempts ?? 0),
        completions: Number(r.completions ?? 0),
        uniquePlayers: Number(r.unique_players ?? 0),
      });
    }

    // 2. Densify: walk every bucket from `now` back to `now - days`,
    //    filling missing keys with zero so the timeline is continuous.
    const points: QuizStatsHistoryPointDto[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const point = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      if (bucket === 'hour') {
        for (let h = 0; h < 24; h++) {
          const slot = new Date(point);
          slot.setHours(h, 0, 0, 0);
          if (slot.getTime() > now.getTime()) continue;
          const key = formatBucketKey(slot, 'hour');
          const v = buckets.get(key);
          points.push({
            date: key,
            attempts: v?.attempts ?? 0,
            completions: v?.completions ?? 0,
            uniquePlayers: v?.uniquePlayers ?? 0,
          });
        }
      } else {
        const key = formatBucketKey(point, 'day');
        const v = buckets.get(key);
        points.push({
          date: key,
          attempts: v?.attempts ?? 0,
          completions: v?.completions ?? 0,
          uniquePlayers: v?.uniquePlayers ?? 0,
        });
      }
    }

    return points;
  }
}

/**
 * Phase 2 (S-9): preview limit. Hard-coded so a malicious client
 * cannot bypass the `isCorrect` strip by requesting every question.
 * The audit's recommendation was 2 — small enough to render as a
 * teaser card, large enough to convey difficulty.
 */
const PREVIEW_QUESTION_COUNT = 2;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function formatBucketKey(date: Date, bucket: 'day' | 'hour'): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  if (bucket === 'hour') {
    const hh = String(date.getUTCHours()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:00:00Z`;
  }
  return `${yyyy}-${mm}-${dd}`;
}
