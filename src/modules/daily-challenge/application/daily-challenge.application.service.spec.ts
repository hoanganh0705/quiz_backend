/* eslint-disable @typescript-eslint/require-await */
/**
 * Unit tests for the Phase 4 (F-2) per-category breakdown method
 * on `DailyChallengeApplicationService`.
 *
 * Coverage:
 *   - Returns the empty payload when the viewer is unauthenticated
 *     (`userId === null`). The route is `@Public()`, so anonymous
 *     viewers must not error out — they get `{ items: [] }`.
 *   - Returns the empty payload when the repository reports no
 *     completed attempts in any category.
 *   - Round-trips the repository rows into the public DTO shape.
 *   - Rounds `averageScorePercent` to 2 decimal places.
 *   - Preserves the repository's `attempt_count DESC, avg DESC`
 *     ordering (the application service does not re-sort).
 */

import { DailyChallengeApplicationService } from './daily-challenge.application.service';
import type { DailyChallengeRepositoryPort } from '../domain/ports/daily-challenge-repository.port';
import type { QuizQuestionRepositoryPort } from '@/modules/quiz/domain/ports/quiz-question-repository.port';
import type { DailyChallengeDomainEventBus } from '../domain/events/daily-challenge-domain.event-bus';
import type { ExternalEventBusProducerPort } from '@/common/events';

class FakeRepository implements Pick<DailyChallengeRepositoryPort, 'getCategoryBreakdown'> {
  rows: Array<{
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    attemptCount: number;
    averageScorePercent: number;
  }> = [];
  calls: string[] = [];

  async getCategoryBreakdown(userId: string) {
    this.calls.push(userId);
    return this.rows;
  }
}

function makeService(repo: FakeRepository): DailyChallengeApplicationService {
  return new DailyChallengeApplicationService(
    repo as unknown as DailyChallengeRepositoryPort,
    {} as unknown as QuizQuestionRepositoryPort,
    {} as unknown as DailyChallengeDomainEventBus,
    {} as unknown as ExternalEventBusProducerPort,
  );
}

describe('DailyChallengeApplicationService.getCategoryBreakdown — Phase 4 (F-2)', () => {
  it('(1) returns { items: [] } for anonymous viewers without calling the repository', async () => {
    const repo = new FakeRepository();
    const service = makeService(repo);

    const result = await service.getCategoryBreakdown(null);

    expect(result).toEqual({ items: [] });
    expect(repo.calls).toEqual([]);
  });

  it('(2) returns { items: [] } when the viewer has no completed attempts', async () => {
    const repo = new FakeRepository();
    const service = makeService(repo);

    const result = await service.getCategoryBreakdown('user-1');

    expect(result).toEqual({ items: [] });
    expect(repo.calls).toEqual(['user-1']);
  });

  it('(3) round-trips repository rows into the public DTO shape', async () => {
    const repo = new FakeRepository();
    repo.rows = [
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
    const service = makeService(repo);

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
    repo.rows = [
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
        // Float edge: should round-half-to-even at 2 dp
        averageScorePercent: 66.665,
      },
    ];
    const service = makeService(repo);

    const result = await service.getCategoryBreakdown('user-1');

    expect(result.items[0]?.averageScorePercent).toBe(78.33);
    expect(result.items[1]?.averageScorePercent).toBe(66.67);
  });

  it('(5) preserves the repository ordering (attemptCount DESC, averageScorePercent DESC)', async () => {
    const repo = new FakeRepository();
    repo.rows = [
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
    const service = makeService(repo);

    const result = await service.getCategoryBreakdown('user-1');

    // The application service must NOT re-sort — the SQL does it.
    // The test asserts that whatever the repository emits, the DTO
    // preserves verbatim.
    expect(result.items.map((i) => i.categoryId)).toEqual(['c1', 'c2', 'c3']);
    expect(result.items.map((i) => i.attemptCount)).toEqual([10, 10, 5]);
  });

  it('(6) handles a single-row payload without errors', async () => {
    const repo = new FakeRepository();
    repo.rows = [
      {
        categoryId: 'c1',
        categoryName: 'Science',
        categorySlug: 'science',
        attemptCount: 1,
        averageScorePercent: 100,
      },
    ];
    const service = makeService(repo);

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
