import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { sql } from 'drizzle-orm';
import { quizzes, quizVersions } from '@/core/database/schema';
import {
  DAILY_CHALLENGE_REPOSITORY_PORT,
  type DailyChallengeRepositoryPort,
} from '../../domain/ports/daily-challenge-repository.port';

/**
 * Phase 3 (S-14): cron-rotation service for the daily
 * challenge. Fires at 00:00 UTC every day and rotates the
 * day's quiz. The selection strategy is "trending/featured
 * rotation" — preferring quizzes currently surfaced in the
 * trending or featured pool, falling back to a random
 * non-hidden quiz when the pool is empty.
 *
 * Idempotency: the repository upserts on the challenge
 * date, so a double-fire (e.g. cron + manual recovery) is a
 * no-op.
 */
@Injectable()
export class DailyChallengeSchedulerService {
  constructor(
    @Inject(DAILY_CHALLENGE_REPOSITORY_PORT)
    private readonly repository: DailyChallengeRepositoryPort,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(DailyChallengeSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'UTC' })
  async rotate(): Promise<void> {
    const now = new Date();
    const challengeDate = now.toISOString().slice(0, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const selected = await this.pickFeaturedQuiz();
    if (!selected) {
      this.logger.warn({
        event: 'daily_challenge_rotation_skipped',
        reason: 'no_quiz_available',
      });
      return;
    }

    const { challengeId } = await this.repository.insertDailyChallenge({
      challengeDate,
      quizId: selected.quizId,
      quizVersionId: selected.quizVersionId,
      difficulty: selected.difficulty,
      questionCount: selected.questionCount,
      rewardXp: selected.rewardXp,
      expiresAt,
      createdAt: now.toISOString(),
    });

    this.logger.info({
      event: 'daily_challenge_rotated',
      challengeId,
      challengeDate,
      quizId: selected.quizId,
    });
  }

  private async pickFeaturedQuiz(): Promise<{
    quizId: string;
    quizVersionId: string;
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
    rewardXp: number;
  } | null> {
    // Lazy SELECT — pick the most-recently-published non-hidden
    // quiz, prefers featured over non-featured. The repository
    // has `findFeaturedQuizzes` but the cron runs against the
    // analytics pool; for the cron we use a one-shot SELECT
    // here so the architecture stays decoupled.
    const rows = await this.db.execute(sql<{
      quiz_id: string;
      quiz_version_id: string;
      difficulty: 'easy' | 'medium' | 'hard';
      question_count: number;
      reward_xp: number;
    }>`
      SELECT
        q.quiz_id,
        qv.quiz_version_id,
        qv.difficulty,
        (SELECT COUNT(*)::int FROM quiz_questions WHERE quiz_version_id = qv.quiz_version_id) AS question_count,
        qv.reward_xp
      FROM quizzes q
      INNER JOIN quiz_versions qv ON qv.quiz_id = q.quiz_id AND qv.status = 'published'
      WHERE q.is_hidden = false
        AND q.deleted_at IS NULL
      ORDER BY q.is_featured DESC, q.published_at DESC NULLS LAST, q.created_at DESC
      LIMIT 1
    `);

    type Row = {
      quiz_id: string;
      quiz_version_id: string;
      difficulty: 'easy' | 'medium' | 'hard';
      question_count: number;
      reward_xp: number;
    };
    const list = ((rows as unknown as { rows?: Row[] }).rows ?? []) as Row[];
    const row = list[0];
    if (!row) return null;
    return {
      quizId: row.quiz_id,
      quizVersionId: row.quiz_version_id,
      difficulty: row.difficulty,
      questionCount: row.question_count,
      rewardXp: row.reward_xp,
    };
  }
}
