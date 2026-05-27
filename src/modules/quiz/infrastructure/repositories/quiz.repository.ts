import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizCategories, quizTags, quizVersions, quizzes } from '@/core/database/schema';
import type {
  CreateQuizPayload,
  QuizCursor,
  QuizListFilters,
  QuizRecordRow,
  QuizRepositoryPort,
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

@Injectable()
export class QuizRepository implements QuizRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getActiveQuizRecordById(quizId: string): Promise<QuizRecordRow | null> {
    const [quiz] = await this.db
      .select({
        quizId: QUIZ_COLUMNS.quizId,
        creatorId: QUIZ_COLUMNS.creatorId,
      })
      .from(quizzes)
      .where(and(eq(QUIZ_COLUMNS.quizId, quizId), isNull(QUIZ_COLUMNS.deletedAt)))
      .limit(1);

    return (quiz as QuizRecordRow | undefined) ?? null;
  }

  async getQuizWithPublishedVersionById(
    quizId: string,
  ): Promise<QuizWithPublishedVersionRow | null> {
    const [row] = await this.db
      .select({
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
      })
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
      .select({
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
      })
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
      filters.push(
        sql`exists (
          select 1
          from ${quizCategories} qc_filter
          where qc_filter.quiz_id = ${QUIZ_COLUMNS.quizId}
            and qc_filter.category_id = ${params.filters.categoryId}
        )`,
      );
    }

    if (params.filters?.tagId) {
      filters.push(
        sql`exists (
          select 1
          from ${quizTags} qt_filter
          where qt_filter.quiz_id = ${QUIZ_COLUMNS.quizId}
            and qt_filter.tag_id = ${params.filters.tagId}
        )`,
      );
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
      .select({
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
      })
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

  async createQuizWithInitialVersion(payload: CreateQuizPayload): Promise<{ quizId: string }> {
    const { nowIso } = payload;

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

      if (payload.categoryIds.length > 0) {
        await tx.insert(quizCategories).values(
          payload.categoryIds.map((categoryId) => ({
            quizId,
            categoryId,
            createdAt: nowIso,
          })),
        );
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
    categoryIds: string[] | null;
    tagIds: string[] | null;
    nowIso: string;
  }): Promise<void> {
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

      if (params.categoryIds) {
        await tx.delete(quizCategories).where(eq(QUIZ_COLUMNS.quizId, params.quizId));

        if (params.categoryIds.length > 0) {
          await tx.insert(quizCategories).values(
            params.categoryIds.map((categoryId) => ({
              quizId: params.quizId,
              categoryId,
              createdAt: params.nowIso,
            })),
          );
        }
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
}
