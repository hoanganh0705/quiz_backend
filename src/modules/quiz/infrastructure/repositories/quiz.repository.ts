import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizTags, quizVersions, quizzes, tags } from '@/core/database/schema';
import {
  isPostgresUniqueViolation,
  isPostgresForeignKeyViolation,
} from '@/common/utils/db-error.util';
import {
  QuizSlugConflictError,
  QuizValidationError,
  QuizOperationFailedError,
} from '@/modules/quiz/domain/errors';
import {
  QUIZ_SLUG_CONFLICT_MESSAGE,
  QUIZ_LINK_IDS_INVALID_MESSAGE,
} from '@/modules/quiz/quiz.constants';
import type {
  CreateQuizPayload,
  FindRelatedQuizzesParams,
  QuizCursor,
  QuizListFilters,
  QuizRecordRow,
  QuizRepositoryPort,
  QuizStatsRow,
  QuizTagRow,
  QuizWithPublishedVersionRow,
} from '@/modules/quiz/domain/ports';

const QUIZ_COLUMNS = quizzes as unknown as {
  quizId: AnyPgColumn;
  creatorId: AnyPgColumn;
  title: AnyPgColumn;
  description: AnyPgColumn;
  slug: AnyPgColumn;
  requirements: AnyPgColumn;
  imageUrl: AnyPgColumn;
  isFeatured: AnyPgColumn;
  isHidden: AnyPgColumn;
  isVerified: AnyPgColumn;
  publishedVersionId: AnyPgColumn;
  categoryId: AnyPgColumn;
  createdAt: AnyPgColumn;
  updatedAt: AnyPgColumn;
  deletedAt: AnyPgColumn;
};

const QUIZ_VERSION_COLUMNS = quizVersions as unknown as {
  quizVersionId: AnyPgColumn;
  versionNumber: AnyPgColumn;
  status: AnyPgColumn;
  difficulty: AnyPgColumn;
  durationMs: AnyPgColumn;
  passingScorePercent: AnyPgColumn;
  rewardXp: AnyPgColumn;
  createdByUserId: AnyPgColumn;
  createdAt: AnyPgColumn;
  publishedAt: AnyPgColumn;
  archivedAt: AnyPgColumn;
  updatedAt: AnyPgColumn;
};

const QUIZ_RECORD_PROJECTION = {
  quizId: QUIZ_COLUMNS.quizId,
  creatorId: QUIZ_COLUMNS.creatorId,
  // Phase 1 / Issue #1 + #25 — these two columns are required by the
  // review module to gate visibility on its public endpoints. We project
  // them here so callers do not have to make a second round-trip to
  // re-fetch the quiz with `getQuizWithPublishedVersionById`.
  isHidden: QUIZ_COLUMNS.isHidden,
  publishedVersionId: QUIZ_COLUMNS.publishedVersionId,
};

const QUIZ_WITH_VERSION_PROJECTION = {
  quizId: QUIZ_COLUMNS.quizId,
  creatorId: QUIZ_COLUMNS.creatorId,
  title: QUIZ_COLUMNS.title,
  description: QUIZ_COLUMNS.description,
  slug: QUIZ_COLUMNS.slug,
  requirements: QUIZ_COLUMNS.requirements,
  imageUrl: QUIZ_COLUMNS.imageUrl,
  isFeatured: QUIZ_COLUMNS.isFeatured,
  isHidden: QUIZ_COLUMNS.isHidden,
  isVerified: QUIZ_COLUMNS.isVerified,
  publishedVersionId: QUIZ_COLUMNS.publishedVersionId,
  categoryId: QUIZ_COLUMNS.categoryId,
  createdAt: QUIZ_COLUMNS.createdAt,
  updatedAt: QUIZ_COLUMNS.updatedAt,
  publishedVersionQuizVersionId: QUIZ_VERSION_COLUMNS.quizVersionId,
  publishedVersionVersionNumber: QUIZ_VERSION_COLUMNS.versionNumber,
  publishedVersionStatus: QUIZ_VERSION_COLUMNS.status,
  publishedVersionDifficulty: QUIZ_VERSION_COLUMNS.difficulty,
  publishedVersionDurationMs: QUIZ_VERSION_COLUMNS.durationMs,
  publishedVersionPassingScorePercent: QUIZ_VERSION_COLUMNS.passingScorePercent,
  publishedVersionRewardXp: QUIZ_VERSION_COLUMNS.rewardXp,
  publishedVersionCreatedByUserId: QUIZ_VERSION_COLUMNS.createdByUserId,
  publishedVersionCreatedAt: QUIZ_VERSION_COLUMNS.createdAt,
  publishedVersionPublishedAt: QUIZ_VERSION_COLUMNS.publishedAt,
  publishedVersionArchivedAt: QUIZ_VERSION_COLUMNS.archivedAt,
  publishedVersionUpdatedAt: QUIZ_VERSION_COLUMNS.updatedAt,
};

@Injectable()
export class QuizRepository implements QuizRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getActiveQuizRecordById(quizId: string): Promise<QuizRecordRow | null> {
    const [quiz] = await this.db
      .select(QUIZ_RECORD_PROJECTION)
      .from(quizzes)
      .where(and(eq(QUIZ_COLUMNS.quizId, quizId), isNull(QUIZ_COLUMNS.deletedAt)))
      .limit(1);

    return (quiz as QuizRecordRow | undefined) ?? null;
  }

  async getQuizWithPublishedVersionById(
    quizId: string,
  ): Promise<QuizWithPublishedVersionRow | null> {
    const [row] = await this.db
      .select(QUIZ_WITH_VERSION_PROJECTION)
      .from(quizzes)
      .leftJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .where(and(eq(QUIZ_COLUMNS.quizId, quizId), isNull(QUIZ_COLUMNS.deletedAt)))
      .limit(1);

    return (row as QuizWithPublishedVersionRow | undefined) ?? null;
  }

  async getQuizWithPublishedVersionBySlug(
    slug: string,
  ): Promise<QuizWithPublishedVersionRow | null> {
    const [row] = await this.db
      .select(QUIZ_WITH_VERSION_PROJECTION)
      .from(quizzes)
      .leftJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .where(
        and(
          eq(QUIZ_COLUMNS.slug, slug),
          isNull(QUIZ_COLUMNS.deletedAt),
          eq(QUIZ_COLUMNS.isHidden, false),
        ),
      )
      .limit(1);

    return (row as QuizWithPublishedVersionRow | undefined) ?? null;
  }

  async getTagsForQuiz(quizId: string): Promise<QuizTagRow[]> {
    const rows = await this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        slug: tags.slug,
      })
      .from(quizTags)
      .innerJoin(tags, eq(quizTags.tagId, tags.tagId))
      .where(and(eq(quizTags.quizId, quizId), isNull(tags.deletedAt)))
      .orderBy(asc(tags.name));

    return rows as QuizTagRow[];
  }

  async listQuizzes(params: {
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]> {
    const filters: SQL[] = [isNull(QUIZ_COLUMNS.deletedAt), eq(QUIZ_COLUMNS.isHidden, false)];

    if (params.filters?.difficulty) {
      filters.push(
        sql`exists (
          select 1
          from ${quizVersions} qv_filter
          where qv_filter.quiz_id = ${QUIZ_COLUMNS.quizId}
            and qv_filter.quiz_version_id = ${QUIZ_COLUMNS.publishedVersionId}
            and qv_filter.difficulty = ${params.filters.difficulty}
        )`,
      );
    }

    if (params.filters?.categoryId) {
      filters.push(eq(QUIZ_COLUMNS.categoryId, params.filters.categoryId));
    }

    if (params.filters?.tagIds && params.filters.tagIds.length > 0) {
      filters.push(
        sql`exists (
          select 1
          from ${quizTags}
          where ${quizTags.quizId} = ${QUIZ_COLUMNS.quizId}
            and ${inArray(quizTags.tagId, params.filters.tagIds)}
        )`,
      );
    }

    if (params.filters?.creatorId) {
      filters.push(eq(QUIZ_COLUMNS.creatorId, params.filters.creatorId));
    }

    if (params.cursor) {
      filters.push(
        or(
          sql`${QUIZ_COLUMNS.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(QUIZ_COLUMNS.createdAt, params.cursor.createdAt),
            sql`${QUIZ_COLUMNS.quizId} < ${params.cursor.quizId}`,
          ),
        ) as SQL,
      );
    }

    const rows = await this.db
      .select(QUIZ_WITH_VERSION_PROJECTION)
      .from(quizzes)
      .leftJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .where(and(...filters))
      .orderBy(desc(QUIZ_COLUMNS.createdAt), desc(QUIZ_COLUMNS.quizId))
      .limit(params.limit + 1);

    return rows as QuizWithPublishedVersionRow[];
  }

  async listByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
  }): Promise<QuizWithPublishedVersionRow[]> {
    const filters: SQL[] = [
      isNull(QUIZ_COLUMNS.deletedAt),
      eq(QUIZ_COLUMNS.isHidden, false),
      eq(QUIZ_COLUMNS.creatorId, params.creatorId),
    ];

    if (params.cursor) {
      filters.push(
        or(
          sql`${QUIZ_COLUMNS.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(QUIZ_COLUMNS.createdAt, params.cursor.createdAt),
            sql`${QUIZ_COLUMNS.quizId} < ${params.cursor.quizId}`,
          ),
        ) as SQL,
      );
    }

    const rows = await this.db
      .select(QUIZ_WITH_VERSION_PROJECTION)
      .from(quizzes)
      .leftJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .where(and(...filters))
      .orderBy(desc(QUIZ_COLUMNS.createdAt), desc(QUIZ_COLUMNS.quizId))
      .limit(params.limit + 1);

    return rows as QuizWithPublishedVersionRow[];
  }

  async listDraftsByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
  }): Promise<QuizWithPublishedVersionRow[]> {
    const filters: SQL[] = [
      isNull(QUIZ_COLUMNS.deletedAt),
      eq(QUIZ_COLUMNS.isHidden, false),
      eq(QUIZ_COLUMNS.creatorId, params.creatorId),
      eq(QUIZ_VERSION_COLUMNS.status, 'draft'),
    ];

    if (params.cursor) {
      filters.push(
        or(
          sql`${QUIZ_COLUMNS.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(QUIZ_COLUMNS.createdAt, params.cursor.createdAt),
            sql`${QUIZ_COLUMNS.quizId} < ${params.cursor.quizId}`,
          ),
        ) as SQL,
      );
    }

    const rows = await this.db
      .select(QUIZ_WITH_VERSION_PROJECTION)
      .from(quizzes)
      .leftJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .where(and(...filters))
      .orderBy(desc(QUIZ_COLUMNS.createdAt), desc(QUIZ_COLUMNS.quizId))
      .limit(params.limit + 1);

    return rows as QuizWithPublishedVersionRow[];
  }

  async listPublishedByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
  }): Promise<QuizWithPublishedVersionRow[]> {
    const filters: SQL[] = [
      isNull(QUIZ_COLUMNS.deletedAt),
      eq(QUIZ_COLUMNS.isHidden, false),
      eq(QUIZ_COLUMNS.creatorId, params.creatorId),
      eq(QUIZ_VERSION_COLUMNS.status, 'published'),
    ];

    if (params.cursor) {
      filters.push(
        or(
          sql`${QUIZ_COLUMNS.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(QUIZ_COLUMNS.createdAt, params.cursor.createdAt),
            sql`${QUIZ_COLUMNS.quizId} < ${params.cursor.quizId}`,
          ),
        ) as SQL,
      );
    }

    const rows = await this.db
      .select(QUIZ_WITH_VERSION_PROJECTION)
      .from(quizzes)
      .leftJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .where(and(...filters))
      .orderBy(desc(QUIZ_COLUMNS.createdAt), desc(QUIZ_COLUMNS.quizId))
      .limit(params.limit + 1);

    return rows as QuizWithPublishedVersionRow[];
  }

  async findFeaturedQuizzes(limit: number): Promise<QuizWithPublishedVersionRow[]> {
    const rows = await this.db
      .select(QUIZ_WITH_VERSION_PROJECTION)
      .from(quizzes)
      .innerJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .where(
        and(
          isNull(QUIZ_COLUMNS.deletedAt),
          eq(QUIZ_COLUMNS.isHidden, false),
          eq(QUIZ_COLUMNS.isFeatured, true),
        ),
      )
      .orderBy(desc(QUIZ_COLUMNS.updatedAt), desc(QUIZ_COLUMNS.quizId))
      .limit(limit);

    return rows as QuizWithPublishedVersionRow[];
  }

  async findRelatedQuizzes(
    params: FindRelatedQuizzesParams,
  ): Promise<QuizWithPublishedVersionRow[]> {
    const rows = await this.db
      .select({
        ...QUIZ_WITH_VERSION_PROJECTION,
        categoryMatchCount: sql<number>`(
          select 1
          from ${quizzes} src_q
          where src_q.slug = ${params.slug}
            and src_q.deleted_at is null
            and src_q.category_id = ${QUIZ_COLUMNS.categoryId}
        )`,
        tagMatchCount: sql<number>`(
          select count(distinct qt.tag_id)
          from ${quizTags} qt
          where qt.quiz_id = ${QUIZ_COLUMNS.quizId}
            and qt.tag_id in (
              select src_qt.tag_id
              from ${quizTags} src_qt
              inner join ${quizzes} src_q on src_q.quiz_id = src_qt.quiz_id
              where src_q.slug = ${params.slug}
                and src_q.deleted_at is null
            )
        )`,
        popularityScoreSort: sql<number>`coalesce((
          select qs.popularity_score::numeric
          from quiz_stats qs
          where qs.quiz_id = ${QUIZ_COLUMNS.quizId}
        ), 0)`,
      })
      .from(quizzes)
      .leftJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .where(
        and(
          isNull(QUIZ_COLUMNS.deletedAt),
          eq(QUIZ_COLUMNS.isHidden, false),
          sql`${QUIZ_COLUMNS.quizId} <> (
            select src.quiz_id
            from ${quizzes} src
            where src.slug = ${params.slug}
              and src.deleted_at is null
            limit 1
          )`,
          sql`(
            exists (
              select 1
              from ${quizzes} src_q
              where src_q.slug = ${params.slug}
                and src_q.deleted_at is null
                and src_q.category_id = ${QUIZ_COLUMNS.categoryId}
            )
            or exists (
              select 1
              from ${quizTags} qt_match
              where qt_match.quiz_id = ${QUIZ_COLUMNS.quizId}
                and qt_match.tag_id in (
                  select src_qt.tag_id
                  from ${quizTags} src_qt
                  inner join ${quizzes} src_q on src_q.quiz_id = src_qt.quiz_id
                  where src_q.slug = ${params.slug}
                    and src_q.deleted_at is null
                )
            )
          )`,
        ),
      )
      .orderBy(
        desc(sql`(
          select 1
          from ${quizzes} src_q
          where src_q.slug = ${params.slug}
            and src_q.deleted_at is null
            and src_q.category_id = ${QUIZ_COLUMNS.categoryId}
        )`),
        desc(sql`(
          select count(distinct qt.tag_id)
          from ${quizTags} qt
          where qt.quiz_id = ${QUIZ_COLUMNS.quizId}
            and qt.tag_id in (
              select src_qt.tag_id
              from ${quizTags} src_qt
              inner join ${quizzes} src_q on src_q.quiz_id = src_qt.quiz_id
              where src_q.slug = ${params.slug}
                and src_q.deleted_at is null
            )
        )`),
        desc(sql`coalesce((
          select qs.popularity_score::numeric
          from quiz_stats qs
          where qs.quiz_id = ${QUIZ_COLUMNS.quizId}
        ), 0)`),
        desc(QUIZ_COLUMNS.createdAt),
        desc(QUIZ_COLUMNS.quizId),
      )
      .limit(params.limit);

    return rows as QuizWithPublishedVersionRow[];
  }

  async getQuizStats(quizId: string): Promise<QuizStatsRow | null> {
    const [stats] = await this.db
      .select({
        quizId: QUIZ_COLUMNS.quizId,
        totalAttempts: sql<number>`COALESCE(${sql.raw('qs.total_attempts')}, 0)`,
        totalPlayers: sql<number>`COALESCE(${sql.raw('qs.total_players')}, 0)`,
        avgScorePercent: sql<string>`COALESCE(${sql.raw('qs.avg_score_percent')}, '0')`,
        avgRating: sql<string>`COALESCE(${sql.raw('qs.avg_rating')}, '0')`,
        ratingCount: sql<number>`COALESCE(${sql.raw('qs.rating_count')}, 0)`,
        bookmarkCount: sql<number>`COALESCE(${sql.raw('qs.bookmark_count')}, 0)`,
        completionRate: sql<string>`COALESCE(${sql.raw('qs.completion_rate')}, '0')`,
        popularityScore: sql<string>`COALESCE(${sql.raw('qs.popularity_score')}, '0')`,
        trendingScore: sql<string>`COALESCE(${sql.raw('qs.trending_score')}, '0')`,
        lastAttemptAt: sql<string | null>`qs.last_attempt_at`,
        lastCalculatedAt: sql<string | null>`qs.last_calculated_at`,
        updatedAt: sql<string>`COALESCE(${sql.raw('qs.updated_at')}, ${QUIZ_COLUMNS.updatedAt})`,
      })
      .from(quizzes)
      .leftJoin(sql`quiz_stats qs`, sql`qs.quiz_id = ${QUIZ_COLUMNS.quizId}`)
      .where(and(eq(QUIZ_COLUMNS.quizId, quizId), isNull(QUIZ_COLUMNS.deletedAt)))
      .limit(1);

    return (stats as QuizStatsRow | undefined) ?? null;
  }

  async createQuizWithInitialVersion(payload: CreateQuizPayload): Promise<{ quizId: string }> {
    const { nowIso } = payload;

    try {
      const result = await this.db.transaction(async (tx) => {
        const [quiz] = await tx
          .insert(quizzes)
          .values({
            creatorId: payload.creatorId,
            title: payload.title,
            slug: payload.slug,
            description: payload.description,
            requirements: payload.requirements,
            imageUrl: payload.imageUrl,
            isFeatured: payload.isFeatured,
            isHidden: payload.isHidden,
            isVerified: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          })
          .returning({
            quizId: QUIZ_COLUMNS.quizId,
          });

        const quizId = quiz.quizId as string;

        await tx.insert(quizVersions).values({
          quizId,
          versionNumber: 1,
          status: 'draft',
          difficulty: payload.initialVersion.difficulty,
          durationMs: payload.initialVersion.durationMs,
          passingScorePercent: payload.initialVersion.passingScorePercent,
          rewardXp: payload.initialVersion.rewardXp,
          createdByUserId: payload.creatorId,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        if (payload.categoryId !== null && payload.categoryId !== undefined) {
          await tx
            .update(quizzes)
            .set({ categoryId: payload.categoryId, updatedAt: nowIso })
            .where(eq(QUIZ_COLUMNS.quizId, quizId));
        }

        if (payload.tagIds.length > 0) {
          await tx.insert(quizTags).values(
            payload.tagIds.map((tagId) => ({
              quizId,
              tagId,
              createdAt: nowIso,
            })),
          );
        }

        return { quizId };
      });

      return { quizId: result.quizId };
    } catch (error) {
      this.mapCreateError(error);
    }
  }

  async updateQuizWithLinks(params: {
    quizId: string;
    patch: {
      title?: string;
      description?: string | null;
      slug?: string;
      requirements?: string | null;
      imageUrl?: string | null;
      isFeatured?: boolean;
      isHidden?: boolean;
    };
    categoryId: string | null;
    tagIds: string[] | null;
    nowIso: string;
  }): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        if (Object.keys(params.patch).length > 0) {
          await tx
            .update(quizzes)
            .set({
              ...params.patch,
              updatedAt: params.nowIso,
            })
            .where(and(eq(QUIZ_COLUMNS.quizId, params.quizId), isNull(QUIZ_COLUMNS.deletedAt)));
        }

        if (params.categoryId !== undefined) {
          await tx
            .update(quizzes)
            .set({ categoryId: params.categoryId, updatedAt: params.nowIso })
            .where(and(eq(QUIZ_COLUMNS.quizId, params.quizId), isNull(QUIZ_COLUMNS.deletedAt)));
        }

        if (params.tagIds) {
          await tx.delete(quizTags).where(eq(QUIZ_COLUMNS.quizId, params.quizId));

          if (params.tagIds.length > 0) {
            await tx.insert(quizTags).values(
              params.tagIds.map((tagId) => ({
                quizId: params.quizId,
                tagId,
                createdAt: params.nowIso,
              })),
            );
          }
        }
      });
    } catch (error) {
      this.mapUpdateError(error);
    }
  }

  async softDeleteQuiz(quizId: string, nowIso: string): Promise<void> {
    await this.db
      .update(quizzes)
      .set({
        deletedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(and(eq(QUIZ_COLUMNS.quizId, quizId), isNull(QUIZ_COLUMNS.deletedAt)));
  }

  private mapCreateError(error: unknown): never {
    if (isPostgresUniqueViolation(error)) {
      throw new QuizSlugConflictError(QUIZ_SLUG_CONFLICT_MESSAGE);
    }

    if (isPostgresForeignKeyViolation(error)) {
      throw new QuizValidationError(QUIZ_LINK_IDS_INVALID_MESSAGE);
    }

    throw new QuizOperationFailedError('Quiz operation failed');
  }

  private mapUpdateError(error: unknown): never {
    if (isPostgresUniqueViolation(error)) {
      throw new QuizSlugConflictError(QUIZ_SLUG_CONFLICT_MESSAGE);
    }

    if (isPostgresForeignKeyViolation(error)) {
      throw new QuizValidationError(QUIZ_LINK_IDS_INVALID_MESSAGE);
    }

    throw new QuizOperationFailedError('Quiz operation failed');
  }
}
