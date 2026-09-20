import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { sql } from 'drizzle-orm';
import type { UserAnalytics } from '../../../domain/types/user-analytics';
import type { UserAnalyticsRawRow } from './user.types';

@Injectable()
export class UserAnalyticsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Combined user analytics in a single round-trip.
   *
   * Replaces three separate aggregations (summary, favorite category,
   * favorite tag) with one query that uses CTEs and `ROW_NUMBER()` so
   * `quiz_attempts` is scanned only once and the favorites are
   * determined in the same pass.
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const result = (await this.db.execute(sql`
        WITH summary AS (
          SELECT
            COUNT(*)::int AS "totalAttempts",
            COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN v.quiz_id END)::int AS "completedQuizzes",
            ROUND(
              COALESCE(
                AVG(CASE WHEN a.status = 'completed' THEN a.score_percent::numeric END),
                0
              ),
              1
            ) AS "averageScore",
            MAX(a.updated_at) AS "lastUpdated"
          FROM quiz_attempts a
          INNER JOIN quiz_versions v ON v.quiz_version_id = a.quiz_version_id
          INNER JOIN users u ON u.user_id = a.user_id
          WHERE a.user_id = ${userId}::uuid
            AND u.deleted_at IS NULL
        ),
        category_counts AS (
          SELECT
            c.category_id AS "categoryId",
            c.name AS "name",
            COUNT(*)::bigint AS cnt,
            ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, c.name ASC) AS rn
          FROM quiz_attempts a
          INNER JOIN quiz_versions v ON v.quiz_version_id = a.quiz_version_id
          INNER JOIN quizzes q ON q.quiz_id = v.quiz_id
          INNER JOIN categories c ON c.category_id = q.category_id
          INNER JOIN users u ON u.user_id = a.user_id
          WHERE a.user_id = ${userId}::uuid
            AND u.deleted_at IS NULL
            AND c.deleted_at IS NULL
          GROUP BY c.category_id, c.name
        ),
        tag_counts AS (
          SELECT
            t.tag_id AS "tagId",
            t.name AS "name",
            COUNT(*)::bigint AS cnt,
            ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, t.name ASC) AS rn
          FROM quiz_attempts a
          INNER JOIN quiz_versions v ON v.quiz_version_id = a.quiz_version_id
          INNER JOIN quiz_tags qt ON qt.quiz_id = v.quiz_id
          INNER JOIN tags t ON t.tag_id = qt.tag_id
          INNER JOIN users u ON u.user_id = a.user_id
          WHERE a.user_id = ${userId}::uuid
            AND u.deleted_at IS NULL
            AND t.deleted_at IS NULL
          GROUP BY t.tag_id, t.name
        )
        SELECT
          s."totalAttempts",
          s."completedQuizzes",
          s."averageScore",
          s."lastUpdated",
          (SELECT "categoryId" FROM category_counts WHERE rn = 1) AS "favoriteCategoryId",
          (SELECT "name" FROM category_counts WHERE rn = 1) AS "favoriteCategoryName",
          (SELECT "tagId" FROM tag_counts WHERE rn = 1) AS "favoriteTagId",
          (SELECT "name" FROM tag_counts WHERE rn = 1) AS "favoriteTagName"
        FROM summary s
      `)) as { rows: UserAnalyticsRawRow[] };

    const row = result.rows[0];

    return {
      userId,
      summary: {
        totalAttempts: Number(row?.totalAttempts ?? 0),
        completedQuizzes: Number(row?.completedQuizzes ?? 0),
        averageScore: Number(row?.averageScore ?? 0),
      },
      favoriteCategory:
        row?.favoriteCategoryId && row?.favoriteCategoryName
          ? { categoryId: row.favoriteCategoryId, name: row.favoriteCategoryName }
          : null,
      favoriteTag:
        row?.favoriteTagId && row?.favoriteTagName
          ? { tagId: row.favoriteTagId, name: row.favoriteTagName }
          : null,
      lastUpdated: row?.lastUpdated ?? new Date().toISOString(),
    };
  }
}
