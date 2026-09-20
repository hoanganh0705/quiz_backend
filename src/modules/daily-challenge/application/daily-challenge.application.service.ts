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
  DailyChallengeCategoryBreakdownResponseDto,
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
import { DailyChallengeDomainEventBus } from '../domain/events/daily-challenge-domain.event-bus';
import { DailyChallengeCompletedEvent } from '../domain/events/daily-challenge-domain.events';
import {
  EXTERNAL_EVENT_BUS_PRODUCER_PORT,
  type ExternalEventBusProducerPort,
} from '@/common/events';
import { createCorrelationId } from '@/common/interceptors/correlation-id';
import {
  SKIPPED_ANSWER_SENTINEL,
  type DailyChallengeDifficulty,
  type DailyChallengeHistoryItem,
  type DailyChallengePeriod,
} from '../domain/types/daily-challenge.types';

const HISTORY_DEFAULT_LIMIT = 5;
const LEADERBOARD_LIMIT = 50;

@Injectable()
export class DailyChallengeApplicationService {
  constructor(
    @Inject(DAILY_CHALLENGE_REPOSITORY_PORT)
    private readonly repository: DailyChallengeRepositoryPort,
    @Inject(QUIZ_QUESTION_REPOSITORY_PORT)
    private readonly quizQuestionRepository: QuizQuestionRepositoryPort,
    private readonly eventBus: DailyChallengeDomainEventBus,
    @Inject(EXTERNAL_EVENT_BUS_PRODUCER_PORT)
    private readonly externalEventBus: ExternalEventBusProducerPort,
  ) {}

  async getToday(userId: string | null): Promise<DailyChallengeResponseDto> {
    const today = this.todayUtcDate();
    const nowIso = new Date().toISOString();

    const row = await this.repository.findByDate(today);
    if (!row) {
      const expired = await this.repository.findMostRecentExpired(nowIso);
      if (expired) {
        return this.buildResponseDto(expired, userId, 'expired');
      }
      throw new DailyChallengeNotFoundError();
    }

    const attempt = userId ? await this.repository.findAttempt(row.challengeId, userId) : null;
    const status = attempt?.completedAt ? 'completed' : 'pending';

    return this.buildResponseDto(row, userId, status);
  }

  async getHistory(
    userId: string | null,
    query: DailyChallengeHistoryQueryDto,
  ): Promise<DailyChallengeHistoryResponseDto> {
    const limit = query.limit ?? HISTORY_DEFAULT_LIMIT;

    if (userId === null) {
      return {
        items: [],
        pagination: {
          kind: 'cursor' as const,
          limit,
          hasNextPage: false,
          nextCursor: null,
        },
      };
    }

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
      items: result.items.map((row) => this.toHistoryItem(row)),
      pagination: {
        kind: 'cursor' as const,
        limit,
        hasNextPage: result.hasNextPage,
        nextCursor,
      },
    };
  }

  async getLeaderboard(
    query: DailyChallengeLeaderboardQueryDto,
  ): Promise<DailyChallengeLeaderboardResponseDto> {
    const period = (query.period ?? 'daily') as DailyChallengePeriod;
    const rows = await this.repository.getLeaderboard({ period, limit: LEADERBOARD_LIMIT });

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

  async getCategoryBreakdown(
    userId: string | null,
  ): Promise<DailyChallengeCategoryBreakdownResponseDto> {
    if (userId === null) {
      return { items: [] };
    }
    const rows = await this.repository.getCategoryBreakdown(userId);
    return {
      items: rows.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        categorySlug: row.categorySlug,
        attemptCount: row.attemptCount,
        averageScorePercent: Math.round(row.averageScorePercent * 100) / 100,
      })),
    };
  }

  async submitAnswer(
    userId: string,
    payload: DailyChallengeAnswerDto,
  ): Promise<DailyChallengeAnswerResponseDto> {
    const today = this.todayUtcDate();
    const row = await this.repository.findByDate(today);
    if (!row) {
      throw new DailyChallengeNotFoundError();
    }

    return this.repository.runInTransaction(async (_tx, helpers) => {
      const attempt = await helpers.lockAttemptForUpdate({
        challengeId: row.challengeId,
        userId,
      });
      const nextIndex = attempt?.nextQuestionIndex ?? 0;

      if (payload.questionIndex !== nextIndex) {
        throw new DailyChallengeConflictError();
      }

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

      const nextAnswers = this.buildNextAnswers(attempt?.answers ?? [], nextIndex, answer);
      const nextQuestionIndex = nextIndex + 1;
      const completed = nextQuestionIndex >= totalQuestions;

      const scorePercent = completed
        ? totalQuestions > 0
          ? this.computeScorePercent(allQuestions, nextAnswers).toFixed(2)
          : '0.00'
        : null;

      const nowIso = new Date().toISOString();

      await helpers.upsertAttempt({
        challengeId: row.challengeId,
        userId,
        answers: nextAnswers,
        nextQuestionIndex,
        totalQuestions,
        scorePercent,
        completedAt: completed ? nowIso : null,
        nowIso,
      });

      if (completed && scorePercent !== null) {
        const correctCount = this.computeCorrectCount(allQuestions, nextAnswers);
        this.eventBus.emitCompleted(
          new DailyChallengeCompletedEvent(
            row.challengeId,
            userId,
            scorePercent,
            correctCount,
            totalQuestions,
            nowIso,
            row.rewardXp,
          ),
        );

        if (row.rewardXp > 0) {
          await this.externalEventBus.publishXpEarned({
            eventType: 'external.xp.earned',
            userId,
            amount: row.rewardXp,
            source: 'bonus',
            timestamp: new Date(nowIso),
            correlationId: createCorrelationId(),
            idempotencyKey: `xp:${userId}:daily_challenge:${row.challengeId}`,
          });
        }
      }

      return {
        correct,
        nextQuestionIndex,
        totalQuestions,
        completed,
        scorePercent: scorePercent !== null ? Number(scorePercent) : null,
      };
    });
  }

  private buildNextAnswers(
    previousAnswers: readonly string[],
    nextIndex: number,
    answer: string | null,
  ): string[] {
    const padded =
      previousAnswers.length <= nextIndex
        ? [
            ...previousAnswers,
            ...Array(nextIndex - previousAnswers.length).fill(SKIPPED_ANSWER_SENTINEL),
          ]
        : previousAnswers;
    const value = answer ?? SKIPPED_ANSWER_SENTINEL;
    return [...padded.slice(0, nextIndex), value, ...padded.slice(nextIndex + 1)];
  }

  private toHistoryItem(row: DailyChallengeHistoryItem) {
    return {
      date: row.challengeDate,
      quizId: row.quizId,
      quizTitle: row.quizTitle ?? 'Untitled quiz',
      slug: row.quizSlug ?? '',
      difficulty: row.difficulty ?? ('medium' as const),
      score: row.scorePercent !== null ? Number(row.scorePercent) : 0,
      rank: 0,
    };
  }

  private computeScorePercent(
    allQuestions: ReadonlyArray<{
      questionId: string;
      optionId: string | null;
      optionIsCorrect: boolean | null;
    }>,
    answers: readonly string[],
  ): number {
    const correct = this.computeCorrectCount(allQuestions, answers);
    return allQuestions.length > 0 ? (correct / allQuestions.length) * 100 : 0;
  }

  private computeCorrectCount(
    allQuestions: ReadonlyArray<{
      questionId: string;
      optionId: string | null;
      optionIsCorrect: boolean | null;
    }>,
    answers: readonly string[],
  ): number {
    const posToCorrectOption = new Map<string, string>();
    for (const q of allQuestions) {
      if (q.optionId !== null && q.optionIsCorrect === true) {
        posToCorrectOption.set(q.questionId, q.optionId);
      }
    }

    let correct = 0;
    for (let i = 0; i < answers.length; i += 1) {
      const answer = answers[i];
      if (!answer || answer === SKIPPED_ANSWER_SENTINEL) continue;
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
      difficulty?: DailyChallengeDifficulty;
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
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).challengeDate === 'string' &&
      typeof (parsed as Record<string, unknown>).challengeId === 'string'
    ) {
      const obj = parsed as { challengeDate: string; challengeId: string };
      return { challengeDate: obj.challengeDate, challengeId: obj.challengeId };
    }
    return null;
  } catch {
    return null;
  }
}
