import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.constants';
import type { DrizzleDB } from '../database.module';
import { quizCategories, quizTags, quizVersions, quizzes } from '../schema';
import type {
  CreateQuizPayload,
  QuizCursor,
  QuizListFilters,
  QuizRecordRow,
  QuizRepositoryPort,
  QuizWithPublishedVersionRow,
} from '@/modules/quiz/domain/ports';

@Injectable()
export class QuizRepository implements QuizRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getActiveQuizRecordById(quizId: string): Promise<QuizRecordRow | null> {
    const [quiz] = await this.db
      .select({
        quizId: quizzes.quizId,
        creatorId: quizzes.creatorId,
      })
      .from(quizzes)
      .where(and(eq(quizzes.quizId, quizId), isNull(quizzes.deletedAt)))
      .limit(1);

    return (quiz as QuizRecordRow | undefined) ?? null;
  }

  async getQuizWithPublishedVersionById(
    quizId: string,
  ): Promise<QuizWithPublishedVersionRow | null> {
    const [row] = await this.db
      .select({
        quizId: quizzes.quizId,
        creatorId: quizzes.creatorId,
        title: quizzes.title,
        description: quizzes.description,
        slug: quizzes.slug,
        requirements: quizzes.requirements,
        imageUrl: quizzes.imageUrl,
        isFeatured: quizzes.isFeatured,
        isHidden: quizzes.isHidden,
        isVerified: quizzes.isVerified,
        publishedVersionId: quizzes.publishedVersionId,
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
        publishedVersionQuizVersionId: quizVersions.quizVersionId,
        publishedVersionVersionNumber: quizVersions.versionNumber,
        publishedVersionStatus: quizVersions.status,
        publishedVersionDifficulty: quizVersions.difficulty,
        publishedVersionDurationMs: quizVersions.durationMs,
        publishedVersionPassingScorePercent: quizVersions.passingScorePercent,
        publishedVersionRewardXp: quizVersions.rewardXp,
        publishedVersionCreatedByUserId: quizVersions.createdByUserId,
        publishedVersionCreatedAt: quizVersions.createdAt,
        publishedVersionPublishedAt: quizVersions.publishedAt,
        publishedVersionArchivedAt: quizVersions.archivedAt,
        publishedVersionUpdatedAt: quizVersions.updatedAt,
      })
      .from(quizzes)
      .leftJoin(quizVersions, eq(quizzes.publishedVersionId, quizVersions.quizVersionId))
      .where(and(eq(quizzes.quizId, quizId), isNull(quizzes.deletedAt)))
      .limit(1);

    return (row as QuizWithPublishedVersionRow | undefined) ?? null;
  }

  async getQuizWithPublishedVersionBySlug(
    slug: string,
  ): Promise<QuizWithPublishedVersionRow | null> {
    const [row] = await this.db
      .select({
        quizId: quizzes.quizId,
        creatorId: quizzes.creatorId,
        title: quizzes.title,
        description: quizzes.description,
        slug: quizzes.slug,
        requirements: quizzes.requirements,
        imageUrl: quizzes.imageUrl,
        isFeatured: quizzes.isFeatured,
        isHidden: quizzes.isHidden,
        isVerified: quizzes.isVerified,
        publishedVersionId: quizzes.publishedVersionId,
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
        publishedVersionQuizVersionId: quizVersions.quizVersionId,
        publishedVersionVersionNumber: quizVersions.versionNumber,
        publishedVersionStatus: quizVersions.status,
        publishedVersionDifficulty: quizVersions.difficulty,
        publishedVersionDurationMs: quizVersions.durationMs,
        publishedVersionPassingScorePercent: quizVersions.passingScorePercent,
        publishedVersionRewardXp: quizVersions.rewardXp,
        publishedVersionCreatedByUserId: quizVersions.createdByUserId,
        publishedVersionCreatedAt: quizVersions.createdAt,
        publishedVersionPublishedAt: quizVersions.publishedAt,
        publishedVersionArchivedAt: quizVersions.archivedAt,
        publishedVersionUpdatedAt: quizVersions.updatedAt,
      })
      .from(quizzes)
      .leftJoin(quizVersions, eq(quizzes.publishedVersionId, quizVersions.quizVersionId))
      .where(and(eq(quizzes.slug, slug), isNull(quizzes.deletedAt), eq(quizzes.isHidden, false)))
      .limit(1);

    return (row as QuizWithPublishedVersionRow | undefined) ?? null;
  }

  async listQuizzes(params: {
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]> {
    const filters: SQL[] = [isNull(quizzes.deletedAt), eq(quizzes.isHidden, false)];

    if (params.filters?.difficulty) {
      filters.push(
        sql`exists (
          select 1
          from ${quizVersions} qv_filter
          where qv_filter.quiz_id = ${quizzes.quizId}
            and qv_filter.quiz_version_id = ${quizzes.publishedVersionId}
            and qv_filter.difficulty = ${params.filters.difficulty}
        )`,
      );
    }

    if (params.filters?.categoryId) {
      filters.push(
        sql`exists (
          select 1
          from ${quizCategories} qc_filter
          where qc_filter.quiz_id = ${quizzes.quizId}
            and qc_filter.category_id = ${params.filters.categoryId}
        )`,
      );
    }

    if (params.filters?.tagId) {
      filters.push(
        sql`exists (
          select 1
          from ${quizTags} qt_filter
          where qt_filter.quiz_id = ${quizzes.quizId}
            and qt_filter.tag_id = ${params.filters.tagId}
        )`,
      );
    }

    if (params.cursor) {
      filters.push(
        or(
          sql`${quizzes.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(quizzes.createdAt, params.cursor.createdAt),
            sql`${quizzes.quizId} < ${params.cursor.quizId}`,
          ),
        ) as SQL,
      );
    }

    const rows = await this.db
      .select({
        quizId: quizzes.quizId,
        creatorId: quizzes.creatorId,
        title: quizzes.title,
        description: quizzes.description,
        slug: quizzes.slug,
        requirements: quizzes.requirements,
        imageUrl: quizzes.imageUrl,
        isFeatured: quizzes.isFeatured,
        isHidden: quizzes.isHidden,
        isVerified: quizzes.isVerified,
        publishedVersionId: quizzes.publishedVersionId,
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
        publishedVersionQuizVersionId: quizVersions.quizVersionId,
        publishedVersionVersionNumber: quizVersions.versionNumber,
        publishedVersionStatus: quizVersions.status,
        publishedVersionDifficulty: quizVersions.difficulty,
        publishedVersionDurationMs: quizVersions.durationMs,
        publishedVersionPassingScorePercent: quizVersions.passingScorePercent,
        publishedVersionRewardXp: quizVersions.rewardXp,
        publishedVersionCreatedByUserId: quizVersions.createdByUserId,
        publishedVersionCreatedAt: quizVersions.createdAt,
        publishedVersionPublishedAt: quizVersions.publishedAt,
        publishedVersionArchivedAt: quizVersions.archivedAt,
        publishedVersionUpdatedAt: quizVersions.updatedAt,
      })
      .from(quizzes)
      .leftJoin(quizVersions, eq(quizzes.publishedVersionId, quizVersions.quizVersionId))
      .where(and(...filters))
      .orderBy(desc(quizzes.createdAt), desc(quizzes.quizId))
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
          quizId: quizzes.quizId,
        });

      await tx.insert(quizVersions).values({
        quizId: quiz.quizId,
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
            quizId: quiz.quizId,
            categoryId,
            createdAt: nowIso,
          })),
        );
      }

      if (payload.tagIds.length > 0) {
        await tx.insert(quizTags).values(
          payload.tagIds.map((tagId) => ({
            quizId: quiz.quizId,
            tagId,
            createdAt: nowIso,
          })),
        );
      }

      return quiz;
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
          .where(and(eq(quizzes.quizId, params.quizId), isNull(quizzes.deletedAt)));
      }

      if (params.categoryIds) {
        await tx.delete(quizCategories).where(eq(quizCategories.quizId, params.quizId));

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
        await tx.delete(quizTags).where(eq(quizTags.quizId, params.quizId));

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
      .where(and(eq(quizzes.quizId, quizId), isNull(quizzes.deletedAt)));
  }
}
