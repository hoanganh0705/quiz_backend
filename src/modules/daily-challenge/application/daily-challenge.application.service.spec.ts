import { DailyChallengeApplicationService } from './daily-challenge.application.service';
import { DailyChallengeCompletedEvent } from '../domain/events/daily-challenge-domain.events';
import { SKIPPED_ANSWER_SENTINEL } from '../domain/types/daily-challenge.types';
import type {
  DailyChallengeAttemptRow,
  DailyChallengeCategoryBreakdownRow,
  DailyChallengeHistoryCursor,
  DailyChallengeHistoryItem,
  DailyChallengeLeaderboardEntry,
  DailyChallengePeriod,
  DailyChallengeRepositoryPort,
  DailyChallengeRow,
  DailyChallengeTx,
} from '../domain/ports/daily-challenge-repository.port';
import type { QuizQuestionRepositoryPort } from '@/modules/quiz/domain/ports/quiz-question-repository.port';
import type { DailyChallengeDomainEventBus } from '../domain/events/daily-challenge-domain.event-bus';
import type { DailyChallengeOutboxPort } from '../infrastructure/outbox/daily-challenge-xp-outbox.adapter';
import {
  DailyChallengeConflictError,
  DailyChallengeNotFoundError,
} from '../domain/errors/daily-challenge.errors';

type Row = DailyChallengeRow & DailyChallengeHistoryItem;

class FakeRepository implements DailyChallengeRepositoryPort {
  rows: Row[] = [];
  breakdown: DailyChallengeCategoryBreakdownRow[] = [];
  leaderboard: DailyChallengeLeaderboardEntry[] = [];
  attempts = new Map<string, DailyChallengeAttemptRow>();
  callLog: string[] = [];
  insertCalls: Array<{ answers: string[]; nextQuestionIndex: number }> = [];

  async findByDate(_date: string): Promise<DailyChallengeRow | null> {
    this.callLog.push('findByDate');
    const today = this.rows.find((r) => r.challengeDate === '2099-01-01') ?? this.rows[0];
    return today ?? null;
  }

  async findMostRecentExpired(_nowIso: string): Promise<DailyChallengeRow | null> {
    this.callLog.push('findMostRecentExpired');
    return this.rows[0] ?? null;
  }

  async findAttempt(
    _challengeId: string,
    _userId: string,
  ): Promise<DailyChallengeAttemptRow | null> {
    this.callLog.push('findAttempt');
    return null;
  }

  async listUserHistory(params: {
    userId: string;
    cursor?: DailyChallengeHistoryCursor | null;
    limit: number;
  }): Promise<{ items: DailyChallengeHistoryItem[]; hasNextPage: boolean }> {
    this.callLog.push(`listUserHistory:${params.userId}`);
    const rows = await Promise.resolve([...this.rows]);
    const sorted = rows.sort((a, b) => {
      if (a.challengeDate === b.challengeDate) {
        return a.challengeId < b.challengeId ? 1 : -1;
      }
      return a.challengeDate > b.challengeDate ? -1 : 1;
    });
    const startIdx = params.cursor
      ? sorted.findIndex(
          (r) =>
            r.challengeDate === params.cursor?.challengeDate &&
            r.challengeId === params.cursor?.challengeId,
        )
      : -1;
    const begin = params.cursor ? (startIdx === -1 ? sorted.length : startIdx + 1) : 0;
    const slice = sorted.slice(begin, begin + params.limit + 1);
    const hasNextPage = slice.length > params.limit;
    return {
      items: (hasNextPage ? slice.slice(0, params.limit) : slice) as DailyChallengeHistoryItem[],
      hasNextPage,
    };
  }

  async getLeaderboard(params: {
    period: DailyChallengePeriod;
    limit: number;
  }): Promise<DailyChallengeLeaderboardEntry[]> {
    this.callLog.push(`getLeaderboard:${params.period}`);
    return this.leaderboard;
  }

  async getUserRank(_params: {
    userId: string;
    period: DailyChallengePeriod;
  }): Promise<number | null> {
    return null;
  }

  async insertDailyChallenge(_params: {
    challengeDate: string;
    quizId: string;
    quizVersionId: string;
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
    rewardXp: number;
    expiresAt: string;
    createdAt: string;
  }): Promise<{ challengeId: string }> {
    return { challengeId: 'inserted' };
  }

  async getCategoryBreakdown(userId: string): Promise<DailyChallengeCategoryBreakdownRow[]> {
    this.callLog.push(userId);
    return this.breakdown;
  }

  async runInTransaction<T>(
    work: (
      _tx: DailyChallengeTx,
      helpers: {
        lockAttemptForUpdate: (params: {
          challengeId: string;
          userId: string;
        }) => Promise<DailyChallengeAttemptRow | null>;
        upsertAttempt: (params: {
          challengeId: string;
          userId: string;
          answers: string[];
          nextQuestionIndex: number;
          totalQuestions: number | null;
          scorePercent: string | null;
          completedAt: string | null;
          nowIso: string;
        }) => Promise<DailyChallengeAttemptRow>;
      },
    ) => Promise<T>,
  ): Promise<T> {
    const helpers = {
      lockAttemptForUpdate: async (_params: {
        challengeId: string;
        userId: string;
      }): Promise<DailyChallengeAttemptRow | null> => {
        this.callLog.push('lockAttemptForUpdate');
        return null;
      },

      upsertAttempt: async (params: {
        challengeId: string;
        userId: string;
        answers: string[];
        nextQuestionIndex: number;
        totalQuestions: number | null;
        scorePercent: string | null;
        completedAt: string | null;
        nowIso: string;
      }): Promise<DailyChallengeAttemptRow> => {
        this.callLog.push('upsertAttempt');
        this.insertCalls.push({
          answers: params.answers,
          nextQuestionIndex: params.nextQuestionIndex,
        });
        return {
          attemptId: 'a1',
          challengeId: params.challengeId,
          userId: params.userId,
          answers: params.answers,
          nextQuestionIndex: params.nextQuestionIndex,
          totalQuestions: params.totalQuestions,
          scorePercent: params.scorePercent,
          completedAt: params.completedAt,
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        };
      },
    };
    return work({} as DailyChallengeTx, helpers);
  }
}

const eventBus = {
  emitCompleted: jest.fn(),
  emitXxx: jest.fn(),
} as unknown as DailyChallengeDomainEventBus & {
  emitCompleted: jest.Mock;
};

const xpOutbox = {
  scheduleXpOutbox: jest.fn().mockResolvedValue(undefined),
} as unknown as DailyChallengeOutboxPort & {
  scheduleXpOutbox: jest.Mock;
};

const quizQuestions: QuizQuestionRepositoryPort = {
  async getQuestionsByVersionId(): Promise<never[]> {
    return [];
  },
} as unknown as QuizQuestionRepositoryPort;

function makeService(
  repo: FakeRepository,
  questionRepo: QuizQuestionRepositoryPort = quizQuestions,
): {
  service: DailyChallengeApplicationService;
  repo: FakeRepository;
} {
  const service = new DailyChallengeApplicationService(repo, questionRepo, eventBus, xpOutbox);
  return { service, repo };
}

const baseRow: Row = {
  challengeId: 'c1',
  challengeDate: '2099-01-01',
  quizId: 'q1',
  quizVersionId: 'qv1',
  rewardXp: 100,
  createdAt: '2026-09-20T00:00:00.000Z',
  expiresAt: '2099-01-02T00:00:00.000Z',
  quizTitle: 'Sample Quiz',
  quizSlug: 'sample-quiz',
  difficulty: 'easy',
  totalQuestions: 3,
  scorePercent: '85.00',
  completedAt: '2099-01-01T00:10:00.000Z',
};

describe('DailyChallengeApplicationService', () => {
  beforeEach(() => {
    eventBus.emitCompleted.mockClear();
    xpOutbox.scheduleXpOutbox.mockClear();
  });

  describe('getCategoryBreakdown', () => {
    it('(1) returns { items: [] } for anonymous viewers without calling the repository', async () => {
      const repo = new FakeRepository();
      const { service } = makeService(repo);
      const result = await service.getCategoryBreakdown(null);
      expect(result).toEqual({ items: [] });
      expect(repo.callLog).toEqual([]);
    });

    it('(2) returns { items: [] } when the viewer has no completed attempts', async () => {
      const repo = new FakeRepository();
      const { service } = makeService(repo);
      const result = await service.getCategoryBreakdown('user-1');
      expect(result).toEqual({ items: [] });
      expect(repo.callLog).toEqual(['user-1']);
    });

    it('(3) round-trips repository rows into the public DTO shape', async () => {
      const repo = new FakeRepository();
      repo.breakdown = [
        {
          categoryId: 'c1',
          categoryName: 'Science',
          categorySlug: 'science',
          attemptCount: 5,
          averageScorePercent: 80,
        },
        {
          categoryId: 'c2',
          categoryName: 'History',
          categorySlug: 'history',
          attemptCount: 3,
          averageScorePercent: 60,
        },
      ];
      const { service } = makeService(repo);
      const result = await service.getCategoryBreakdown('user-1');
      expect(result.items).toEqual([
        {
          categoryId: 'c1',
          categoryName: 'Science',
          categorySlug: 'science',
          attemptCount: 5,
          averageScorePercent: 80,
        },
        {
          categoryId: 'c2',
          categoryName: 'History',
          categorySlug: 'history',
          attemptCount: 3,
          averageScorePercent: 60,
        },
      ]);
    });

    it('(4) rounds averageScorePercent to 2 decimal places (e.g. 78.3333 -> 78.33)', async () => {
      const repo = new FakeRepository();
      repo.breakdown = [
        {
          categoryId: 'c1',
          categoryName: 'Science',
          categorySlug: 'science',
          attemptCount: 3,
          averageScorePercent: 78.3333,
        },
        {
          categoryId: 'c2',
          categoryName: 'History',
          categorySlug: 'history',
          attemptCount: 2,
          averageScorePercent: 66.665,
        },
      ];
      const { service } = makeService(repo);
      const result = await service.getCategoryBreakdown('user-1');
      expect(result.items[0]?.averageScorePercent).toBe(78.33);
      expect(result.items[1]?.averageScorePercent).toBe(66.67);
    });

    it('(5) preserves the repository ordering (attemptCount DESC, averageScorePercent DESC)', async () => {
      const repo = new FakeRepository();
      repo.breakdown = [
        {
          categoryId: 'c1',
          categoryName: 'Science',
          categorySlug: 'science',
          attemptCount: 10,
          averageScorePercent: 50,
        },
        {
          categoryId: 'c2',
          categoryName: 'History',
          categorySlug: 'history',
          attemptCount: 10,
          averageScorePercent: 90,
        },
        {
          categoryId: 'c3',
          categoryName: 'Geography',
          categorySlug: 'geography',
          attemptCount: 5,
          averageScorePercent: 70,
        },
      ];
      const { service } = makeService(repo);
      const result = await service.getCategoryBreakdown('user-1');
      expect(result.items.map((i) => i.categoryId)).toEqual(['c1', 'c2', 'c3']);
      expect(result.items.map((i) => i.attemptCount)).toEqual([10, 10, 5]);
    });

    it('(6) handles a single-row payload without errors', async () => {
      const repo = new FakeRepository();
      repo.breakdown = [
        {
          categoryId: 'c1',
          categoryName: 'Science',
          categorySlug: 'science',
          attemptCount: 1,
          averageScorePercent: 100,
        },
      ];
      const { service } = makeService(repo);
      const result = await service.getCategoryBreakdown('user-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        categoryId: 'c1',
        categoryName: 'Science',
        categorySlug: 'science',
        attemptCount: 1,
        averageScorePercent: 100,
      });
    });
  });

  describe('getToday', () => {
    it('throws DailyChallengeNotFoundError when no row exists for today and no expired snapshot', async () => {
      const repo = new FakeRepository();
      const { service } = makeService(repo);
      await expect(service.getToday('user-1')).rejects.toBeInstanceOf(DailyChallengeNotFoundError);
    });

    it('returns expired snapshot when today has no row but a previous expired row exists', async () => {
      const repo = new FakeRepository();
      repo.rows = [{ ...baseRow, challengeDate: '2099-01-01' }];

      repo.findByDate = async (): Promise<DailyChallengeRow | null> => null;

      repo.findMostRecentExpired = async (): Promise<DailyChallengeRow | null> =>
        repo.rows[0] ?? null;
      const { service } = makeService(repo);
      const result = await service.getToday('user-1');
      expect(result.status).toBe('expired');
    });

    it('returns pending status for a user who has not started the challenge', async () => {
      const repo = new FakeRepository();
      repo.rows = [{ ...baseRow }];
      const { service } = makeService(repo);
      const result = await service.getToday('user-1');
      expect(result.status).toBe('pending');
      expect(result.questionCount).toBe(3);
      expect(result.rewardXp).toBe(100);
    });

    it('returns completed status when the user has a completed attempt', async () => {
      const repo = new FakeRepository();
      repo.rows = [{ ...baseRow }];
      repo.attempts.set('user-1', {
        attemptId: 'a1',
        challengeId: 'c1',
        userId: 'user-1',
        answers: ['a', 'b', 'c'],
        nextQuestionIndex: 3,
        totalQuestions: 3,
        scorePercent: '100.00',
        completedAt: '2099-01-01T00:05:00.000Z',
        createdAt: '2099-01-01T00:00:00.000Z',
        updatedAt: '2099-01-01T00:05:00.000Z',
      });
      const findAttemptSpy = jest
        .spyOn(repo, 'findAttempt')

        .mockImplementation(async () => repo.attempts.get('user-1') ?? null);
      const { service } = makeService(repo);
      const result = await service.getToday('user-1');
      expect(result.status).toBe('completed');
      findAttemptSpy.mockRestore();
    });
  });

  describe('getHistory', () => {
    it('returns an empty page for anonymous viewers', async () => {
      const repo = new FakeRepository();
      const { service } = makeService(repo);
      const result = await service.getHistory(null, { limit: 5 });
      expect(result.items).toEqual([]);
      expect(result.pagination).toEqual({
        kind: 'cursor',
        limit: 5,
        hasNextPage: false,
        nextCursor: null,
      });
    });

    it('round-trips rows with real score and difficulty', async () => {
      const repo = new FakeRepository();
      repo.rows = [
        {
          ...baseRow,
          challengeId: 'c2',
          scorePercent: null,
          difficulty: 'medium',
          challengeDate: '2099-01-01',
        },
        { ...baseRow, scorePercent: '85.50', difficulty: 'easy', challengeDate: '2099-01-02' },
      ];
      const { service } = makeService(repo);
      const result = await service.getHistory('user-1', { limit: 5 });
      expect(result.items[0]).toMatchObject({
        date: '2099-01-02',
        quizTitle: 'Sample Quiz',
        slug: 'sample-quiz',
        difficulty: 'easy',
        score: 85.5,
      });
      expect(result.items[1]).toMatchObject({
        date: '2099-01-01',
        quizTitle: 'Sample Quiz',
        slug: 'sample-quiz',
        difficulty: 'medium',
        score: 0,
      });
    });

    it('falls back to defaults when quiz title and slug are missing', async () => {
      const repo = new FakeRepository();
      const missingTitle = {
        ...baseRow,
        challengeDate: '2099-01-02',
      };
      delete (missingTitle as Record<string, unknown>)['quizTitle'];
      delete (missingTitle as Record<string, unknown>)['quizSlug'];
      delete (missingTitle as Record<string, unknown>)['difficulty'];
      repo.rows = [missingTitle];
      const { service } = makeService(repo);
      const result = await service.getHistory('user-1', { limit: 5 });
      expect(result.items[0]).toMatchObject({
        quizTitle: 'Untitled quiz',
        slug: '',
        difficulty: 'medium',
      });
    });

    it('encodes the next cursor when more pages exist', async () => {
      const repo = new FakeRepository();
      repo.rows = [
        { ...baseRow, challengeId: 'c1', challengeDate: '2099-01-03' },
        { ...baseRow, challengeId: 'c2', challengeDate: '2099-01-02' },
        { ...baseRow, challengeId: 'c3', challengeDate: '2099-01-01' },
      ];
      const { service } = makeService(repo);
      const result = await service.getHistory('user-1', { limit: 2 });
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBeTruthy();
      const decoded = JSON.parse(
        Buffer.from(result.pagination.nextCursor ?? '', 'base64url').toString('utf-8'),
      ) as DailyChallengeHistoryCursor;
      expect(decoded.challengeId).toBe('c2');
    });
  });

  describe('cursor helpers', () => {
    it('round-trips well-formed cursor data', async () => {
      const repo = new FakeRepository();
      repo.rows = [
        { ...baseRow, challengeId: 'c1', challengeDate: '2099-01-03' },
        { ...baseRow, challengeId: 'c2', challengeDate: '2099-01-02' },
        { ...baseRow, challengeId: 'c3', challengeDate: '2099-01-01' },
      ];
      const { service } = makeService(repo);
      const page1 = await service.getHistory('user-1', { limit: 2 });
      const cursor = page1.pagination.nextCursor ?? '';
      const page2 = await service.getHistory('user-1', { limit: 2, cursor });
      expect(page2.pagination.hasNextPage).toBe(false);
    });

    it('gracefully ignores malformed cursor values', async () => {
      const repo = new FakeRepository();
      repo.rows = [{ ...baseRow }];
      const { service } = makeService(repo);
      const result = await service.getHistory('user-1', {
        limit: 5,
        cursor: 'not-a-valid-cursor',
      });
      expect(result.pagination.hasNextPage).toBe(false);
    });
  });

  describe('getLeaderboard', () => {
    it('defaults to daily period when none supplied', async () => {
      const repo = new FakeRepository();
      repo.leaderboard = [
        {
          userId: 'u1',
          username: 'alice',
          displayName: 'Alice',
          avatarUrl: null,
          scorePercent: 99,
        },
      ];
      const { service } = makeService(repo);
      const result = await service.getLeaderboard({});
      expect(result.period).toBe('daily');
      expect(result.entries[0]?.rank).toBe(1);
      expect(result.entries[0]?.username).toBe('alice');
    });

    it('honours the requested period', async () => {
      const repo = new FakeRepository();
      const { service } = makeService(repo);
      await service.getLeaderboard({ period: 'weekly' });
      expect(repo.callLog).toContain('getLeaderboard:weekly');
    });
  });

  describe('submitAnswer', () => {
    const repoWithTodayAndQuestions = (): {
      repo: FakeRepository;
      quizQuestions: QuizQuestionRepositoryPort & { getQuestionsByVersionId: jest.Mock };
    } => {
      const repo = new FakeRepository();
      repo.rows = [{ ...baseRow }];
      const quiz = {
        getQuestionsByVersionId: jest.fn().mockResolvedValue([
          {
            questionId: 'q1',
            optionId: 'correct-opt-1',
            optionIsCorrect: true,
            position: 0,
          },
          {
            questionId: 'q2',
            optionId: 'correct-opt-2',
            optionIsCorrect: true,
            position: 1,
          },
          {
            questionId: 'q3',
            optionId: 'correct-opt-3',
            optionIsCorrect: true,
            position: 2,
          },
        ]),
      } as unknown as QuizQuestionRepositoryPort & { getQuestionsByVersionId: jest.Mock };
      return { repo, quizQuestions: quiz };
    };

    it('throws DailyChallengeNotFoundError when no challenge for today', async () => {
      const repo = new FakeRepository();
      const { service } = makeService(repo);
      await expect(
        service.submitAnswer('user-1', { questionIndex: 0, selectedOptionId: 'opt' }),
      ).rejects.toBeInstanceOf(DailyChallengeNotFoundError);
    });

    it('throws DailyChallengeConflictError when questionIndex is out of sync', async () => {
      const { repo } = repoWithTodayAndQuestions();
      repo.runInTransaction = async <T>(
        work: (
          _tx: DailyChallengeTx,
          helpers: {
            lockAttemptForUpdate: (params: {
              challengeId: string;
              userId: string;
            }) => Promise<DailyChallengeAttemptRow | null>;
            upsertAttempt: (params: {
              challengeId: string;
              userId: string;
              answers: string[];
              nextQuestionIndex: number;
              totalQuestions: number | null;
              scorePercent: string | null;
              completedAt: string | null;
              nowIso: string;
            }) => Promise<DailyChallengeAttemptRow>;
          },
        ) => Promise<T>,
      ): Promise<T> => {
        const helpers = {
          lockAttemptForUpdate: async (): Promise<DailyChallengeAttemptRow | null> => ({
            attemptId: 'a1',
            challengeId: 'c1',
            userId: 'user-1',
            answers: ['x', SKIPPED_ANSWER_SENTINEL],
            nextQuestionIndex: 2,
            totalQuestions: 3,
            scorePercent: null,
            completedAt: null,
            createdAt: '2099-01-01T00:00:00.000Z',
            updatedAt: '2099-01-01T00:00:00.000Z',
          }),
          upsertAttempt: jest.fn(),
        };
        return work({} as DailyChallengeTx, helpers);
      };
      const { service } = makeService(repo);
      await expect(
        service.submitAnswer('user-1', { questionIndex: 0, selectedOptionId: 'opt' }),
      ).rejects.toBeInstanceOf(DailyChallengeConflictError);
    });

    it('returns correct=false for a wrong answer and does not emit completion', async () => {
      const { repo, quizQuestions } = repoWithTodayAndQuestions();
      const { service } = makeService(repo, quizQuestions);
      const result = await service.submitAnswer('user-1', {
        questionIndex: 0,
        selectedOptionId: 'wrong-opt',
      });
      expect(result.correct).toBe(false);
      expect(result.completed).toBe(false);
      expect(result.nextQuestionIndex).toBe(1);
      expect(result.scorePercent).toBeNull();
      expect(eventBus.emitCompleted).not.toHaveBeenCalled();
      expect(quizQuestions.getQuestionsByVersionId).toHaveBeenCalledWith('qv1');
    });

    it('returns correct=true for a correct answer and emits completion + xp on the final question', async () => {
      const { repo, quizQuestions } = repoWithTodayAndQuestions();
      repo.runInTransaction = async <T>(
        work: (
          _tx: DailyChallengeTx,
          helpers: {
            lockAttemptForUpdate: (params: {
              challengeId: string;
              userId: string;
            }) => Promise<DailyChallengeAttemptRow | null>;
            upsertAttempt: (params: {
              challengeId: string;
              userId: string;
              answers: string[];
              nextQuestionIndex: number;
              totalQuestions: number | null;
              scorePercent: string | null;
              completedAt: string | null;
              nowIso: string;
            }) => Promise<DailyChallengeAttemptRow>;
          },
        ) => Promise<T>,
      ): Promise<T> => {
        const helpers = {
          lockAttemptForUpdate: async (): Promise<DailyChallengeAttemptRow | null> => ({
            attemptId: 'a1',
            challengeId: 'c1',
            userId: 'user-1',
            answers: ['correct-opt-1', 'correct-opt-2'],
            nextQuestionIndex: 2,
            totalQuestions: 3,
            scorePercent: null,
            completedAt: null,
            createdAt: '2099-01-01T00:00:00.000Z',
            updatedAt: '2099-01-01T00:00:00.000Z',
          }),

          upsertAttempt: async (params: {
            challengeId: string;
            userId: string;
            answers: string[];
            nextQuestionIndex: number;
            totalQuestions: number | null;
            scorePercent: string | null;
            completedAt: string | null;
            nowIso: string;
          }): Promise<DailyChallengeAttemptRow> => {
            repo.insertCalls.push({
              answers: params.answers,
              nextQuestionIndex: params.nextQuestionIndex,
            });
            return {
              attemptId: 'a1',
              challengeId: params.challengeId,
              userId: params.userId,
              answers: params.answers,
              nextQuestionIndex: params.nextQuestionIndex,
              totalQuestions: params.totalQuestions,
              scorePercent: params.scorePercent,
              completedAt: params.completedAt,
              createdAt: params.nowIso,
              updatedAt: params.nowIso,
            };
          },
        };
        return work({} as DailyChallengeTx, helpers);
      };
      const { service } = makeService(repo, quizQuestions);
      const result = await service.submitAnswer('user-1', {
        questionIndex: 2,
        selectedOptionId: 'correct-opt-3',
      });
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.scorePercent).toBe(100);
      expect(eventBus.emitCompleted).toHaveBeenCalledTimes(1);
      const emitted = (eventBus.emitCompleted.mock.calls[0]?.[0] ??
        null) as DailyChallengeCompletedEvent | null;
      expect(emitted).toBeInstanceOf(DailyChallengeCompletedEvent);
      expect(emitted?.correctCount).toBe(3);
      expect(emitted?.totalQuestions).toBe(3);
      expect(xpOutbox.scheduleXpOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: 100,
          challengeId: 'c1',
          idempotencyKey: 'xp:user-1:daily_challenge:c1',
        }),
        expect.anything(),
        expect.any(String),
      );
    });

    it('skips xp publish when rewardXp is zero', async () => {
      const { repo, quizQuestions } = repoWithTodayAndQuestions();
      repo.rows = [{ ...baseRow, rewardXp: 0 }];
      const { service } = makeService(repo, quizQuestions);
      await service.submitAnswer('user-1', {
        questionIndex: 0,
        selectedOptionId: 'correct-opt-1',
      });
      expect(xpOutbox.scheduleXpOutbox).not.toHaveBeenCalled();
    });

    it('pads prior answers with the skip sentinel when attempt is shorter', async () => {
      const { repo, quizQuestions } = repoWithTodayAndQuestions();
      repo.runInTransaction = async <T>(
        work: (
          _tx: DailyChallengeTx,
          helpers: {
            lockAttemptForUpdate: (params: {
              challengeId: string;
              userId: string;
            }) => Promise<DailyChallengeAttemptRow | null>;
            upsertAttempt: (params: {
              challengeId: string;
              userId: string;
              answers: string[];
              nextQuestionIndex: number;
              totalQuestions: number | null;
              scorePercent: string | null;
              completedAt: string | null;
              nowIso: string;
            }) => Promise<DailyChallengeAttemptRow>;
          },
        ) => Promise<T>,
      ): Promise<T> => {
        const helpers = {
          lockAttemptForUpdate: async (): Promise<DailyChallengeAttemptRow | null> => null,

          upsertAttempt: async (params: {
            challengeId: string;
            userId: string;
            answers: string[];
            nextQuestionIndex: number;
            totalQuestions: number | null;
            scorePercent: string | null;
            completedAt: string | null;
            nowIso: string;
          }): Promise<DailyChallengeAttemptRow> => {
            repo.insertCalls.push({
              answers: params.answers,
              nextQuestionIndex: params.nextQuestionIndex,
            });
            return {
              attemptId: 'a1',
              challengeId: params.challengeId,
              userId: params.userId,
              answers: params.answers,
              nextQuestionIndex: params.nextQuestionIndex,
              totalQuestions: params.totalQuestions,
              scorePercent: params.scorePercent,
              completedAt: params.completedAt,
              createdAt: params.nowIso,
              updatedAt: params.nowIso,
            };
          },
        };
        return work({} as DailyChallengeTx, helpers);
      };
      const { service } = makeService(repo, quizQuestions);
      await service.submitAnswer('user-1', {
        questionIndex: 0,
        selectedOptionId: null,
      });
      const recorded = repo.insertCalls[0];
      expect(recorded).toBeDefined();
      const padded = recorded?.answers ?? [];
      expect(padded.length).toBe(1);
      expect(padded[0]).toBe(SKIPPED_ANSWER_SENTINEL);
    });
  });
});
