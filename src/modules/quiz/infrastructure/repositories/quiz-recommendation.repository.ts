import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizAttempts, quizStats, quizTags, quizVersions, quizzes } from '@/core/database/schema';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type {
  QuizRecommendationRepositoryPort,
  ScoredQuizRow,
} from '../../domain/analytics/ports/quiz-recommendation.repository-port';

const QUIZ_COLUMNS = quizzes as unknown as {
  quizId: AnyPgColumn;
  creatorId: AnyPgColumn;
  title: AnyPgColumn;
  description: AnyPgColumn;
  slug: AnyPgColumn;
  requirements: AnyPgColumn;
  imageUrl: AnyPgColumn;
  categoryId: AnyPgColumn;
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
  quizId: AnyPgColumn;
  status: AnyPgColumn;
};

@Injectable()
export class QuizRecommendationRepository implements QuizRecommendationRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findRecommendedQuizzes(params: {
    userId: string;
    limit: number;
  }): Promise<ScoredQuizRow[]> {
    const WEIGHT_CATEGORY = 50;
    const WEIGHT_TAG = 30;
    const WEIGHT_POPULARITY = 10;
    const WEIGHT_TRENDING = 10;

    const candidateQuizzes = await this.db
      .select({
        quizId: QUIZ_COLUMNS.quizId,
        creatorId: QUIZ_COLUMNS.creatorId,
        title: QUIZ_COLUMNS.title,
        description: QUIZ_COLUMNS.description,
        slug: QUIZ_COLUMNS.slug,
        requirements: QUIZ_COLUMNS.requirements,
        imageUrl: QUIZ_COLUMNS.imageUrl,
        categoryId: QUIZ_COLUMNS.categoryId,
        isFeatured: QUIZ_COLUMNS.isFeatured,
        isHidden: QUIZ_COLUMNS.isHidden,
        isVerified: QUIZ_COLUMNS.isVerified,
        publishedVersionId: QUIZ_COLUMNS.publishedVersionId,
        createdAt: QUIZ_COLUMNS.createdAt,
        updatedAt: QUIZ_COLUMNS.updatedAt,
        publishedVersionQuizVersionId: QUIZ_VERSION_COLUMNS.quizVersionId,
        publishedVersionVersionNumber: sql`null`,
        publishedVersionStatus: QUIZ_VERSION_COLUMNS.status,
        publishedVersionDifficulty: sql`null`,
        publishedVersionDurationMs: sql`null`,
        publishedVersionPassingScorePercent: sql`null`,
        publishedVersionRewardXp: sql`null`,
        publishedVersionCreatedByUserId: sql`null`,
        publishedVersionCreatedAt: sql`null`,
        publishedVersionPublishedAt: sql`null`,
        publishedVersionArchivedAt: sql`null`,
        publishedVersionUpdatedAt: sql`null`,
        categoryMatchCount: sql<number>`COALESCE((
          select 1
          from ${quizAttempts} attempt_user
          inner join ${quizVersions} qv_user on qv_user.quiz_version_id = attempt_user.quiz_version_id
          where qv_user.quiz_id = ${QUIZ_COLUMNS.quizId}
            and attempt_user.user_id = ${params.userId}
            and exists (
              select 1 from ${quizzes} q_user
              inner join ${quizzes} q_match on q_match.category_id = q_user.category_id
              where q_user.quiz_id = qv_user.quiz_id
                and q_match.quiz_id = ${QUIZ_COLUMNS.quizId}
            )
        ), 0)`,
        tagMatchCount: sql<number>`COALESCE((
          select count(distinct qt_matching.tag_id)
          from ${quizTags} qt_matching
          inner join ${quizTags} qt_user on qt_matching.tag_id = qt_user.tag_id
          inner join ${quizAttempts} attempt_user on
            exists (
              select 1 from ${quizVersions} qv_excl
              where qv_excl.quiz_id = qt_user.quiz_id
                and qv_excl.quiz_version_id = attempt_user.quiz_version_id
            )
          where qt_matching.quiz_id = ${QUIZ_COLUMNS.quizId}
            and attempt_user.user_id = ${params.userId}
        ), 0)`,
        popularityScore: sql<number>`coalesce(${quizStats.popularityScore}::numeric, 0)`,
        trendingScore: sql<number>`coalesce(${quizStats.trendingScore}::numeric, 0)`,
        recommendationScore: sql<number>`(
          ${WEIGHT_CATEGORY} * COALESCE((
            select 1
            from ${quizAttempts} attempt_user
            inner join ${quizVersions} qv_user on qv_user.quiz_version_id = attempt_user.quiz_version_id
            where qv_user.quiz_id = ${QUIZ_COLUMNS.quizId}
              and attempt_user.user_id = ${params.userId}
              and exists (
                select 1 from ${quizzes} q_user
                inner join ${quizzes} q_match on q_match.category_id = q_user.category_id
                where q_user.quiz_id = qv_user.quiz_id
                  and q_match.quiz_id = ${QUIZ_COLUMNS.quizId}
              )
          ), 0)
          + ${WEIGHT_TAG} * COALESCE((
            select count(distinct qt_matching.tag_id)
            from ${quizTags} qt_matching
            inner join ${quizTags} qt_user on qt_matching.tag_id = qt_user.tag_id
            inner join ${quizAttempts} attempt_user on
              exists (
                select 1 from ${quizVersions} qv_excl
                where qv_excl.quiz_id = qt_user.quiz_id
                  and qv_excl.quiz_version_id = attempt_user.quiz_version_id
              )
            where qt_matching.quiz_id = ${QUIZ_COLUMNS.quizId}
              and attempt_user.user_id = ${params.userId}
          ), 0)
          + ${WEIGHT_POPULARITY} * coalesce(${quizStats.popularityScore}::numeric, 0)
          + ${WEIGHT_TRENDING} * coalesce(${quizStats.trendingScore}::numeric, 0)
        ) AS recommendation_score`,
      })
      .from(quizzes)
      .innerJoin(
        quizVersions,
        eq(QUIZ_COLUMNS.publishedVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .leftJoin(quizStats, eq(QUIZ_COLUMNS.quizId, quizStats.quizId))
      .where(
        and(
          isNull(QUIZ_COLUMNS.deletedAt),
          eq(QUIZ_COLUMNS.isHidden, false),
          sql`${QUIZ_COLUMNS.quizId} NOT IN (
            select distinct qv_rec.quiz_id
            from ${quizVersions} qv_rec
            inner join ${quizAttempts} att_rec on att_rec.quiz_version_id = qv_rec.quiz_version_id
            where att_rec.user_id = ${params.userId}
              and att_rec.status = 'completed'
          )`,
        ),
      )
      .orderBy(desc(sql`recommendation_score`))
      .limit(params.limit);

    return candidateQuizzes as unknown as ScoredQuizRow[];
  }
}
