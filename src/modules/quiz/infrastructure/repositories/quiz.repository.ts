import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, DRIZZLE_READ } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  categories,
  quizQuestions,
  quizStats,
  quizTags,
  quizVersions,
  quizzes,
  tags,
  userProfiles,
  users,
} from '@/core/database/schema';
import type {
  AuthorSummaryRow,
  CategorySummaryRow,
  CreateQuizPayload,
  FindRelatedQuizzesParams,
  QuizAggregatesRow,
  QuizCursor,
  QuizListFilters,
  QuizRecordRow,
  QuizRepositoryPort,
  QuizStatsRow,
  QuizTagRow,
  QuizWithPublishedVersionRow,
} from '@/modules/quiz/domain/ports';
import { QUIZ_COLUMNS, QUIZ_VERSION_COLUMNS } from './quiz.repository.columns';
import {
  QUIZ_RECORD_PROJECTION,
  QUIZ_WITH_VERSION_PROJECTION,
} from './quiz.repository.projections';
import { buildQuizListQuery } from './quiz.repository.list-query';
import { mapQuizCreateError, mapQuizUpdateError } from './quiz.repository.errors';

@Injectable()
export class QuizRepository implements QuizRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(DRIZZLE_READ) private readonly dbRead: DrizzleDB,
  ) {}

  async getActiveQuizRecordById(quizId: string): Promise<QuizRecordRow | null> {
    const [quiz] = await this.dbRead
      .select(QUIZ_RECORD_PROJECTION)
      .from(quizzes)
      .where(and(eq(QUIZ_COLUMNS.quizId, quizId), isNull(QUIZ_COLUMNS.deletedAt)))
      .limit(1);

    return (quiz as QuizRecordRow | undefined) ?? null;
  }

  /**
   * Public read of a quiz by UUID.
   *
   * SECURITY: explicitly filters out hidden quizzes (`isHidden = false`).
   * Hidden quizzes can only be reached through ownership-scoped endpoints
   * (PATCH/DELETE/...); bypassing the filter would let unauthenticated
   * callers enumerate every quiz UUID and read the body of `isHidden`
   * quizzes that the owner intentionally hid from public listings.
   * Mirrors the filter applied by `getQuizWithPublishedVersionBySlug`.
   */
  async getQuizWithPublishedVersionById(
    quizId: string,
  ): Promise<QuizWithPublishedVersionRow | null> {
    const [row] = await this.dbRead
      .select(QUIZ_WITH_VERSION_PROJECTION)
      .from(quizzes)
      .leftJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .where(
        and(
          eq(QUIZ_COLUMNS.quizId, quizId),
          isNull(QUIZ_COLUMNS.deletedAt),
          eq(QUIZ_COLUMNS.isHidden, false),
        ),
      )
      .limit(1);

    return (row as QuizWithPublishedVersionRow | undefined) ?? null;
  }

  async getQuizWithPublishedVersionBySlug(
    slug: string,
  ): Promise<QuizWithPublishedVersionRow | null> {
    const [row] = await this.dbRead
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
    const rows = await this.dbRead
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

  async getTagsForQuizIds(quizIds: string[]): Promise<Map<string, QuizTagRow[]>> {
    if (quizIds.length === 0) return new Map();
    const rows = await this.dbRead
      .select({
        quizId: quizTags.quizId,
        tagId: tags.tagId,
        name: tags.name,
        slug: tags.slug,
      })
      .from(quizTags)
      .innerJoin(tags, eq(quizTags.tagId, tags.tagId))
      .where(and(inArray(quizTags.quizId, quizIds), isNull(tags.deletedAt)))
      .orderBy(asc(quizTags.quizId), asc(tags.name));

    const out = new Map<string, QuizTagRow[]>();
    for (const row of rows) {
      const list = out.get(row.quizId) ?? [];
      list.push({ tagId: row.tagId, name: row.name, slug: row.slug });
      out.set(row.quizId, list);
    }
    return out;
  }

  async getAuthorSummaries(userIds: string[]): Promise<Map<string, AuthorSummaryRow>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.dbRead
      .select({
        userId: users.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        avatarPublicId: userProfiles.avatarPublicId,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(inArray(users.userId, userIds), isNull(users.deletedAt)));

    const out = new Map<string, AuthorSummaryRow>();
    for (const row of rows) {
      out.set(row.userId, {
        userId: row.userId,
        username: row.username,
        displayName: row.displayName ?? null,
        avatarUrl: row.avatarUrl ?? null,
        avatarPublicId: row.avatarPublicId ?? null,
      });
    }
    return out;
  }

  async getCategorySummaries(categoryIds: string[]): Promise<Map<string, CategorySummaryRow>> {
    if (categoryIds.length === 0) return new Map();
    const rows = await this.dbRead
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
        slug: categories.slug,
      })
      .from(categories)
      .where(and(inArray(categories.categoryId, categoryIds), isNull(categories.deletedAt)));

    const out = new Map<string, CategorySummaryRow>();
    for (const row of rows) {
      out.set(row.categoryId, {
        categoryId: row.categoryId,
        name: row.name,
        slug: row.slug,
      });
    }
    return out;
  }

  /**
   * Reads aggregate stats from the denormalised `quiz_stats`
   * materialised view. Quizzes without a row return nulls and we
   * surface that as `(0, 0, 0)` defaults at the mapper layer.
   */
  async getAggregatesForQuizzes(quizIds: string[]): Promise<Map<string, QuizAggregatesRow>> {
    if (quizIds.length === 0) return new Map();
    const rows = await this.dbRead
      .select({
        quizId: quizStats.quizId,
        averageRating: sql<number>`COALESCE(${quizStats.avgRating}, 0)`,
        reviewCount: sql<number>`COALESCE(${quizStats.ratingCount}, 0)`,
        attemptCount: sql<number>`COALESCE(${quizStats.totalAttempts}, 0)`,
      })
      .from(quizStats)
      .where(inArray(quizStats.quizId, quizIds));

    const out = new Map<string, QuizAggregatesRow>();
    for (const row of rows) {
      out.set(row.quizId, {
        quizId: row.quizId,
        averageRating: Number(row.averageRating ?? 0),
        reviewCount: Number(row.reviewCount ?? 0),
        attemptCount: Number(row.attemptCount ?? 0),
      });
    }
    return out;
  }

  async getQuestionCountsForVersionIds(versionIds: string[]): Promise<Map<string, number>> {
    if (versionIds.length === 0) return new Map();
    const rows = await this.dbRead
      .select({
        quizVersionId: quizQuestions.quizVersionId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(quizQuestions)
      .where(inArray(quizQuestions.quizVersionId, versionIds))
      .groupBy(quizQuestions.quizVersionId);

    const out = new Map<string, number>();
    for (const row of rows) {
      out.set(row.quizVersionId, Number(row.count));
    }
    return out;
  }

  async listQuizzes(params: {
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]> {
    return this.runListQuery(params.filters ?? null, params.cursor, params.limit);
  }

  /**
   * Centralised list-endpoint executor. Builds the (filter, orderBy,
   * sortKey) tuple via `buildQuizListQuery`, appends any caller-supplied
   * `extraFilters` (e.g. the "has any draft version" predicate used by
   * `listDraftsByCreatorId`), and executes against the read replica.
   *
   * Centralising keeps the four list methods (public, by-creator,
   * drafts-by-creator, published-by-creator) consistent: any new
   * filter added to the public surface is automatically available to
   * the per-creator routes.
   */
  private async runListQuery(
    filtersIn: QuizListFilters | null,
    cursor: QuizCursor | null | undefined,
    limit: number,
    extraFilters: SQL[] = [],
  ): Promise<QuizWithPublishedVersionRow[]> {
    const { filters, orderBy, sortKey } = buildQuizListQuery(filtersIn ?? undefined, cursor);
    filters.push(...extraFilters);

    const baseFrom = this.dbRead
      .select(QUIZ_WITH_VERSION_PROJECTION)
      .from(quizzes)
      .leftJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      );

    const rows =
      sortKey === 'popular' || sortKey === 'top_rated' || sortKey === 'trending'
        ? await baseFrom
            .leftJoin(sql`quiz_stats qs`, sql`qs.quiz_id = ${QUIZ_COLUMNS.quizId}`)
            .where(and(...filters))
            .orderBy(...orderBy)
            .limit(limit + 1)
        : await baseFrom
            .where(and(...filters))
            .orderBy(...orderBy)
            .limit(limit + 1);

    return rows as QuizWithPublishedVersionRow[];
  }

  async listByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]> {
    // Delegate to `listQuizzes` so the creator-scoped routes inherit
    // the same filter surface (difficulty / categoryId / tagIds / q /
    // sort / minRating). The `creatorId` filter pins ownership; the
    // public `isHidden = false` default is preserved unless the caller
    // overrides it via `filters.isHidden`.
    return this.listQuizzes({
      limit: params.limit,
      cursor: params.cursor,
      filters: {
        ...(params.filters ?? {}),
        creatorId: params.creatorId,
      },
    });
  }

  async listPublishedByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]> {
    // "Published" here means "has a published version". The shared
    // `listQuizzes` path already JOINs on `published_version_id`, so
    // delegation gives us the right semantics for free.
    return this.listByCreatorId(params);
  }

  async listDraftsByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]> {
    // Pin the query to quizzes that have at least one draft version.
    //
    // The previous implementation filtered via `LEFT JOIN
    // quiz_versions ON published_version_id = quiz_version_id` and
    // added `quiz_versions.status = 'draft'`. That was incorrect —
    // `published_version_id` references the *published* version (if
    // any), so the status check would only match quizzes whose
    // published version was somehow in 'draft' state (which the state
    // machine prevents). The right predicate is `EXISTS (SELECT 1
    // FROM quiz_versions WHERE quiz_id = q.quiz_id AND status =
    // 'draft')`, expressed as an `extraFilters` clause on the shared
    // runner so it composes with the rest of the filter surface.
    return this.runListQuery(
      { ...(params.filters ?? {}), creatorId: params.creatorId },
      params.cursor,
      params.limit,
      [
        sql`exists (
          select 1
          from ${quizVersions} qv_draft
          where qv_draft.quiz_id = ${QUIZ_COLUMNS.quizId}
            and qv_draft.status = 'draft'
        )`,
      ],
    );
  }

  async findFeaturedQuizzes(limit: number): Promise<QuizWithPublishedVersionRow[]> {
    const rows = await this.dbRead
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
    // Step 1: resolve the source quiz (one row by slug) — a single
    // index lookup, not correlated against every candidate row.
    const [sourceRow] = await this.dbRead
      .select({ quizId: QUIZ_COLUMNS.quizId, categoryId: QUIZ_COLUMNS.categoryId })
      .from(quizzes)
      .where(and(eq(QUIZ_COLUMNS.slug, params.slug), isNull(QUIZ_COLUMNS.deletedAt)))
      .limit(1);

    if (!sourceRow || !sourceRow.quizId) {
      return [];
    }

    // Step 2: pull the source quiz's tag IDs in one indexed query.
    const sourceTagRows = await this.dbRead
      .select({ tagId: quizTags.tagId })
      .from(quizTags)
      .where(eq(quizTags.quizId, sourceRow.quizId as string));

    const sourceTagIds = sourceTagRows.map((r) => r.tagId);
    const sourceCategoryId = sourceRow.categoryId;
    const hasSourceCategory = sourceCategoryId !== null && sourceCategoryId !== undefined;
    const hasSourceTags = sourceTagIds.length > 0;

    // No overlap possible when the source quiz has no category and no
    // tags — short-circuit to an empty list.
    if (!hasSourceCategory && !hasSourceTags) {
      return [];
    }

    // Step 3: run the candidate scan with predicates expressed as
    // concrete values rather than correlated subqueries against
    // `quizzes.slug = $slug`. The category match becomes a simple
    // equality predicate; the tag match becomes a `quiz_tags.tag_id IN
    // ($sourceTagIds)` predicate against an indexed column.
    const tagOverlapExistsFilter = hasSourceTags
      ? hasSourceCategory
        ? or(
            eq(QUIZ_COLUMNS.categoryId, sourceCategoryId as string),
            sql`exists (
                select 1
                from ${quizTags}
                where ${quizTags.quizId} = ${QUIZ_COLUMNS.quizId}
                  and ${inArray(quizTags.tagId, sourceTagIds)}
              )`,
          )
        : sql`exists (
              select 1
              from ${quizTags}
              where ${quizTags.quizId} = ${QUIZ_COLUMNS.quizId}
                and ${inArray(quizTags.tagId, sourceTagIds)}
            )`
      : hasSourceCategory
        ? eq(QUIZ_COLUMNS.categoryId, sourceCategoryId as string)
        : sql`false`;

    const categoryMatchOrder = sql<number>`CASE WHEN ${QUIZ_COLUMNS.categoryId} = ${sourceCategoryId ?? sql`NULL`} THEN 1 ELSE 0 END`;
    const tagMatchOrder = hasSourceTags
      ? sql<number>`(
          SELECT COUNT(DISTINCT qt.tag_id)::int
          FROM ${quizTags} qt
          WHERE qt.quiz_id = ${QUIZ_COLUMNS.quizId}
            AND qt.tag_id IN ${inArray(quizTags.tagId, sourceTagIds)}
        )`
      : sql<number>`0`;

    const rows = await this.dbRead
      .select({
        ...QUIZ_WITH_VERSION_PROJECTION,
        categoryMatchCount: hasSourceCategory
          ? sql<number>`CASE WHEN ${QUIZ_COLUMNS.categoryId} = ${sourceCategoryId} THEN 1 ELSE 0 END`
          : sql<number>`0`,
        tagMatchCount: tagMatchOrder,
        popularityScoreSort: sql<number>`COALESCE(${sql.raw('qs.popularity_score')}, 0)`,
      })
      .from(quizzes)
      .leftJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .leftJoin(sql`quiz_stats qs`, sql`qs.quiz_id = ${QUIZ_COLUMNS.quizId}`)
      .where(
        and(
          isNull(QUIZ_COLUMNS.deletedAt),
          eq(QUIZ_COLUMNS.isHidden, false),
          sql`${QUIZ_COLUMNS.quizId} <> ${sourceRow.quizId}`,
          tagOverlapExistsFilter,
        ),
      )
      .orderBy(
        desc(categoryMatchOrder),
        desc(tagMatchOrder),
        desc(sql`COALESCE(${sql.raw('qs.popularity_score')}, 0)`),
        desc(QUIZ_COLUMNS.createdAt),
        desc(QUIZ_COLUMNS.quizId),
      )
      .limit(params.limit);

    return rows as QuizWithPublishedVersionRow[];
  }

  async getQuizStats(quizId: string): Promise<QuizStatsRow | null> {
    const [stats] = await this.dbRead
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

  async createQuizWithInitialVersion(
    payload: CreateQuizPayload,
  ): Promise<{ row: QuizWithPublishedVersionRow; tags: QuizTagRow[] }> {
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
            imagePublicId: payload.imagePublicId,
            isFeatured: payload.isFeatured,
            isHidden: payload.isHidden,
            isVerified: false,
            // Fold the categoryId into the initial INSERT instead of
            // issuing a follow-up UPDATE; saves one round-trip per create.
            categoryId: payload.categoryId ?? null,
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

        let tagRows: QuizTagRow[] = [];
        if (payload.tagIds.length > 0) {
          await tx.insert(quizTags).values(
            payload.tagIds.map((tagId) => ({
              quizId,
              tagId,
              createdAt: nowIso,
            })),
          );

          const resolvedTags = await tx
            .select({
              tagId: tags.tagId,
              name: tags.name,
              slug: tags.slug,
            })
            .from(quizTags)
            .innerJoin(tags, eq(quizTags.tagId, tags.tagId))
            .where(and(eq(quizTags.quizId, quizId), isNull(tags.deletedAt)))
            .orderBy(asc(tags.name));

          tagRows = resolvedTags as QuizTagRow[];
        }

        const row: QuizWithPublishedVersionRow = {
          quizId,
          creatorId: payload.creatorId,
          title: payload.title,
          description: payload.description,
          slug: payload.slug,
          requirements: payload.requirements,
          imageUrl: payload.imageUrl,
          imagePublicId: payload.imagePublicId,
          categoryId: payload.categoryId ?? null,
          isFeatured: payload.isFeatured,
          isHidden: payload.isHidden,
          isVerified: false,
          publishedVersionId: null,
          createdAt: nowIso,
          updatedAt: nowIso,
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
        } as QuizWithPublishedVersionRow;

        return { row, tags: tagRows };
      });

      return result;
    } catch (error) {
      mapQuizCreateError(error);
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
      imagePublicId?: string | null;
      isFeatured?: boolean;
      isHidden?: boolean;
    };
    categoryId: string | null;
    tagIds: string[] | null;
    nowIso: string;
  }): Promise<{ row: QuizWithPublishedVersionRow; tags: QuizTagRow[] } | null> {
    try {
      const result = await this.db.transaction(async (tx) => {
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

        const [row] = await tx
          .select(QUIZ_WITH_VERSION_PROJECTION)
          .from(quizzes)
          .leftJoin(
            quizVersions,
            eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
          )
          .where(and(eq(QUIZ_COLUMNS.quizId, params.quizId), isNull(QUIZ_COLUMNS.deletedAt)))
          .limit(1);

        if (!row) {
          return null;
        }

        const tagRows = (await tx
          .select({
            tagId: tags.tagId,
            name: tags.name,
            slug: tags.slug,
          })
          .from(quizTags)
          .innerJoin(tags, eq(quizTags.tagId, tags.tagId))
          .where(and(eq(quizTags.quizId, params.quizId), isNull(tags.deletedAt)))
          .orderBy(asc(tags.name))) as QuizTagRow[];

        return { row: row as QuizWithPublishedVersionRow, tags: tagRows };
      });

      return result;
    } catch (error) {
      mapQuizUpdateError(error);
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

  async findQuizCoverPublicIdById(quizId: string): Promise<string | null> {
    const [row] = await this.dbRead
      .select({ imagePublicId: QUIZ_COLUMNS.imagePublicId })
      .from(quizzes)
      .where(and(eq(QUIZ_COLUMNS.quizId, quizId), isNull(QUIZ_COLUMNS.deletedAt)))
      .limit(1);

    return (row?.imagePublicId as string | null | undefined) ?? null;
  }
}
