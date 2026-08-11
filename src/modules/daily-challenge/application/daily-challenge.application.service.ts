import { Inject, Injectable } from '@nestjs/common';
import {
  DAILY_CHALLENGE_REPOSITORY_PORT,
  type DailyChallengeRepositoryPort,
} from '../domain/ports/daily-challenge-repository.port';
import {
  QUIZ_QUESTION_REPOSITORY_PORT,
  type QuizQuestionRepositoryPort,
} from '@/modules/quiz/domain/ports/quiz-question-repository.port';
import type { DailyChallengeResponseDto } from '../dto/response/daily-challenge-response.dto';
import type {
  DailyChallengeAnswerResponseDto,
  DailyChallengeHistoryResponseDto,
  DailyChallengeLeaderboardResponseDto,
} from '../dto/response/daily-challenge-history-response.dto';
import type {
  DailyChallengeAnswerDto,
  DailyChallengeHistoryQueryDto,
  DailyChallengeLeaderboardQueryDto,
} from '../dto/request/daily-challenge-queries.dto';
import {
  DailyChallengeConflictError,
  DailyChallengeNotFoundError,
} from '../domain/errors/daily-challenge.errors';

/**
 * Phase 3 (S-14): orchestrates the four daily-challenge endpoints
 * (`today`, `history`, `leaderboard`, `answer`).
 *
 * The application service is the only place that reads the
 * repository row and renders the public DTO. The controller +
 * presenter layers above stay thin — the application service
 * owns the `status: pending | completed | expired` discriminator
 * and the cursor decode.
 */
@Injectable()
export class DailyChallengeApplicationService {
  constructor(
    @Inject(DAILY_CHALLENGE_REPOSITORY_PORT)
    private readonly repository: DailyChallengeRepositoryPort,
    @Inject(QUIZ_QUESTION_REPOSITORY_PORT)
    private readonly quizQuestionRepository: QuizQuestionRepositoryPort,
  ) {}

  /**
   * `GET /daily-challenge/today`. Returns the day's snapshot
   * for the viewer; status is computed from the user's attempt
   * row (if any) and the current time.
   */
  async getToday(userId: string | null): Promise<DailyChallengeResponseDto> {
    const today = this.todayUtcDate();
    const nowIso = new Date().toISOString();

    const row = await this.repository.findByDate(today);
    if (!row) {
      // Render an "expired" snapshot using the most-recent
      // challenge whose window has closed. This handles the
      // post-rotation window where the cron has not yet inserted
      // the next day.
      const expired = await this.repository.findMostRecentExpired(nowIso);
      if (expired) {
        return this.buildResponseDto(expired, userId, 'expired');
      }
      throw new DailyChallengeNotFoundError('No active daily challenge for today.');
    }

    const attempt = userId ? await this.repository.findAttempt(row.challengeId, userId) : null;
    const status = attempt?.completedAt ? 'completed' : 'pending';

    return this.buildResponseDto(row, userId, status);
  }

  /**
   * `GET /daily-challenge/history`. Cursor-paginated.
   */
  async getHistory(
    userId: string,
    query: DailyChallengeHistoryQueryDto,
  ): Promise<DailyChallengeHistoryResponseDto> {
    const limit = query.limit ?? 5;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const result = await this.repository.listUserHistory({
      userId,
      cursor,
      limit,
    });

    const lastItem = result.items.at(-1);
    const nextCursor =
      result.hasNextPage && lastItem
        ? encodeCursor({ challengeDate: lastItem.challengeDate, challengeId: lastItem.challengeId })
        : null;

    return {
      items: result.items.map((row) => ({
        date: row.challengeDate,
        quizId: row.quizId,
        quizTitle: row.quizTitle ?? 'Untitled quiz',
        slug: row.quizSlug ?? '',
        difficulty: 'medium' as const,
        score: 0,
        rank: 0,
      })),
      pagination: {
        kind: 'cursor' as const,
        limit,
        hasNextPage: result.hasNextPage,
        nextCursor,
      },
    };
  }

  /**
   * `GET /daily-challenge/leaderboard`.
   */
  async getLeaderboard(
    query: DailyChallengeLeaderboardQueryDto,
  ): Promise<DailyChallengeLeaderboardResponseDto> {
    const period = query.period ?? 'daily';
    const rows = await this.repository.getLeaderboard({ period, limit: 50 });

    return {
      period,
      entries: rows.map((row, idx) => ({
        rank: idx + 1,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        scorePercent: row.scorePercent,
      })),
    };
  }

  /**
   * `POST /daily-challenge/answer`. The endpoint is stateful —
   * the server tracks the in-flight attempt and only resolves
   * `correct` against the question at `questionIndex`. Out-of-sync
   * submissions return 409.
   */
  async submitAnswer(
    userId: string,
    payload: DailyChallengeAnswerDto,
  ): Promise<DailyChallengeAnswerResponseDto> {
    const today = this.todayUtcDate();
    const row = await this.repository.findByDate(today);
    if (!row) {
      throw new DailyChallengeNotFoundError('No active daily challenge for today.');
    }

    const attempt = await this.repository.findAttempt(row.challengeId, userId);
    const nextIndex = attempt?.nextQuestionIndex ?? 0;

    if (payload.questionIndex !== nextIndex) {
      throw new DailyChallengeConflictError(
        'Daily challenge attempt is out of sync with the next question index.',
      );
    }

    // Pull the version's questions (the question repo joins
    // options in one round-trip). We select exactly one
    // question at `nextIndex` from the list.
    const allQuestions = await this.quizQuestionRepository.getQuestionsByVersionId(
      row.quizVersionId,
    );
    const totalQuestions = allQuestions.length;
    const currentQuestion = allQuestions.find((q) => q.position === nextIndex);

    if (!currentQuestion) {
      throw new DailyChallengeNotFoundError(
        'Daily challenge question at the requested index could not be located.',
      );
    }

    const answer = payload.selectedOptionId ?? null;
    const correct =
      answer !== null &&
      currentQuestion.optionId === answer &&
      currentQuestion.optionIsCorrect === true;

    const nextAnswers: string[] = [...(attempt?.answers ?? [])];
    // Pad if necessary so the positional log stays consistent.
    while (nextAnswers.length <= nextIndex) nextAnswers.push('__skipped__');
    nextAnswers[nextIndex] = answer ?? '__skipped__';
    const nextQuestionIndex = nextIndex + 1;
    const completed = nextQuestionIndex >= totalQuestions;

    let scorePercent: string | null = null;
    if (completed) {
      const correctCount = this.countCorrectAnswers(allQuestions, nextAnswers);
      scorePercent =
        totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(2) : '0.00';
    }

    await this.repository.upsertAttempt({
      challengeId: row.challengeId,
      userId,
      answers: nextAnswers,
      nextQuestionIndex: completed ? nextQuestionIndex : nextQuestionIndex,
      totalQuestions,
      scorePercent,
      completedAt: completed ? new Date().toISOString() : null,
      nowIso: new Date().toISOString(),
    });

    return {
      correct,
      nextQuestionIndex: completed ? nextQuestionIndex : nextQuestionIndex,
      totalQuestions,
      completed,
      scorePercent: scorePercent !== null ? Number(scorePercent) : null,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private countCorrectAnswers(
    allQuestions: Array<{
      questionId: string;
      optionId: string | null;
      optionIsCorrect: boolean | null;
    }>,
    answers: string[],
  ): number {
    // Build a per-question correct-option map.
    let correct = 0;
    const posToCorrectOption = new Map<string, string>();
    for (const q of allQuestions) {
      if (q.optionId !== null && q.optionIsCorrect === true) {
        posToCorrectOption.set(q.questionId, q.optionId);
      }
    }
    for (let i = 0; i < answers.length; i += 1) {
      const answer = answers[i];
      if (!answer || answer === '__skipped__') continue;
      const q = allQuestions[i];
      if (!q) continue;
      if (posToCorrectOption.get(q.questionId) === answer) correct += 1;
    }
    return correct;
  }

  private buildResponseDto(
    row: {
      challengeId: string;
      challengeDate: string;
      quizId: string;
      rewardXp: number;
      createdAt: string;
      expiresAt: string;
      quizTitle?: string;
      quizSlug?: string;
      difficulty?: 'easy' | 'medium' | 'hard';
      totalQuestions?: number;
    },
    _userId: string | null,
    status: 'pending' | 'completed' | 'expired',
  ): DailyChallengeResponseDto {
    return {
      date: row.challengeDate,
      quizId: row.quizId,
      quizTitle: row.quizTitle ?? '',
      slug: row.quizSlug ?? '',
      difficulty: row.difficulty ?? 'medium',
      questionCount: row.totalQuestions ?? 0,
      rewardXp: row.rewardXp,
      expiresAt: row.expiresAt,
      status,
      scorePercent: null,
      rank: null,
    };
  }

  private todayUtcDate(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

function encodeCursor(cursor: { challengeDate: string; challengeId: string }): string {
  return Buffer.from(JSON.stringify(cursor), 'utf-8').toString('base64url');
}

function decodeCursor(cursor: string): { challengeDate: string; challengeId: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    if (typeof parsed.challengeDate === 'string' && typeof parsed.challengeId === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
