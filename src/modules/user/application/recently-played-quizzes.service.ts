import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizAttempts, quizzes, quizVersions } from '@/core/database/schema';
import type {
  RecentlyPlayedQuizzesResponseDto,
  RecentlyPlayedQuizItemDto,
} from '../dto/response/recently-played-quizzes.dto';

/**
 * Phase 3 (S-16): read service for the recently-played-quizzes
 * endpoint. Reads `quiz_attempts` for the viewer and joins the
 * quiz (via `quiz_versions.quiz_id`) so the row is self-
 * contained. Status filter is `status = 'completed'` so
 * in-progress attempts do not pollute the list.
 */
@Injectable()
export class RecentlyPlayedQuizzesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getRecentlyPlayed(
    userId: string,
    params: {
      cursor?: { playedAt: string; attemptId: string } | null;
      limit: number;
    },
  ): Promise<RecentlyPlayedQuizzesResponseDto> {
    const filters: SQL[] = [
      eq(quizAttempts.userId, userId),
      eq(quizAttempts.status, 'completed'),
      isNull(quizzes.deletedAt),
    ];

    if (params.cursor) {
      filters.push(
        sql`(COALESCE(${quizAttempts.finishedAt}::text, ${quizAttempts.createdAt}::text), ${quizAttempts.attemptId}) < (${params.cursor.playedAt}, ${params.cursor.attemptId})`,
      );
    }

    const rows = await this.db
      .select({
        attemptId: quizAttempts.attemptId,
        quizId: quizzes.quizId,
        quizTitle: quizzes.title,
        slug: quizzes.slug,
        difficulty: quizVersions.difficulty,
        imageUrl: quizzes.imageUrl,
        playedAt: sql<string>`COALESCE(${quizAttempts.finishedAt}::text, ${quizAttempts.createdAt}::text)`,
        scorePercent: quizAttempts.scorePercent,
      })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizVersions.quizVersionId, quizAttempts.quizVersionId))
      .innerJoin(quizzes, eq(quizzes.quizId, quizVersions.quizId))
      .where(and(...filters))
      .orderBy(
        desc(sql`COALESCE(${quizAttempts.finishedAt}, ${quizAttempts.createdAt})`),
        desc(quizAttempts.attemptId),
      )
      .limit(params.limit + 1);

    const hasNextPage = rows.length > params.limit;
    const items = (hasNextPage ? rows.slice(0, params.limit) : rows) as Array<{
      attemptId: string;
      quizId: string;
      quizTitle: string;
      slug: string;
      difficulty: 'easy' | 'medium' | 'hard' | null;
      imageUrl: string | null;
      playedAt: string;
      scorePercent: string | number | null;
    }>;

    const lastItem = items.at(-1);
    const nextCursor =
      hasNextPage && lastItem
        ? Buffer.from(
            JSON.stringify({ playedAt: lastItem.playedAt, attemptId: lastItem.attemptId }),
            'utf8',
          ).toString('base64url')
        : null;

    const dtoItems: RecentlyPlayedQuizItemDto[] = items.map((row) => ({
      quizId: row.quizId,
      quizTitle: row.quizTitle,
      slug: row.slug,
      difficulty: row.difficulty ?? 'medium',
      imageUrl: row.imageUrl,
      playedAt: row.playedAt,
      scorePercent: row.scorePercent !== null ? Number(row.scorePercent) : 0,
    }));

    return {
      items: dtoItems,
      pagination: {
        kind: 'cursor' as const,
        limit: params.limit,
        hasNextPage,
        nextCursor,
      },
    };
  }
}
