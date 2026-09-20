import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { commentRows } from '@/core/database/schema';
import {
  QUIZ_REPOSITORY_PORT,
  type QuizRepositoryPort,
} from '../domain/ports/quiz-repository.port';
import type { QuizStatsHistoryPointDto } from '../dto/response/quiz-stats-history-point.dto';

type HistoryRange = '7d' | '30d';
type HistoryBucket = 'day' | 'hour';

@Injectable()
export class QuizStatsHistoryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(QUIZ_REPOSITORY_PORT) private readonly quizRepository: QuizRepositoryPort,
  ) {}

  async countCommentsForQuiz(quizId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(commentRows)
      .where(and(eq(commentRows.quizId, quizId), isNull(commentRows.deletedAt)));
    return Number(row?.count ?? 0);
  }

  fetchRecentActivity(quizId: string, days: number): Promise<QuizStatsHistoryPointDto[]> {
    return this.fetchHistoryPoints(quizId, days === 7 ? '7d' : '30d', 'day');
  }

  async fetchHistoryPoints(
    quizId: string,
    range: HistoryRange,
    bucket: HistoryBucket,
  ): Promise<QuizStatsHistoryPointDto[]> {
    const days = range === '7d' ? 7 : 30;
    const bucketColumn = bucket === 'hour' ? 'hour' : 'day';

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

function formatBucketKey(date: Date, bucket: HistoryBucket): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  if (bucket === 'hour') {
    const hh = String(date.getUTCHours()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:00:00Z`;
  }
  return `${yyyy}-${mm}-${dd}`;
}
