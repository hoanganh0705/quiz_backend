/// <reference types="jest" />
import { ReviewOutboxAdapter } from './review-outbox.adapter';

describe('ReviewOutboxAdapter — Phase 1 / Issue #3 (transactional outbox)', () => {
  function makeDrizzleStub(insertions: unknown[]) {
    const insertBuilder = {
      values: jest.fn().mockReturnThis(),
      onConflictDoNothing: jest.fn().mockImplementation(() => {
        insertions.push('inserted');
        return Promise.resolve();
      }),
    };
    return {
      insert: jest.fn(() => insertBuilder),
      _builder: insertBuilder,
    };
  }

  it('schedules review.submitted via the supplied transaction so it is atomic with the review insert', async () => {
    const db = makeDrizzleStub([]);
    const adapter = new ReviewOutboxAdapter(db as never);
    const txInsertions: unknown[] = [];
    const txStub = {
      insert: jest.fn(() => ({
        values: jest.fn().mockReturnThis(),
        onConflictDoNothing: jest.fn(() => {
          txInsertions.push('inserted');
          return Promise.resolve();
        }),
      })),
    };

    await adapter.scheduleReviewSubmitted(
      { quizId: 'q1', reviewId: 'r1', userId: 'u1', rating: 5 },
      txStub,
      '2026-07-19T00:00:00.000Z',
    );

    // We passed `tx` (a stub), so the adapter must call `insert` on
    // the tx, not on the db. This is the property that makes the
    // outbox row atomic with the originating transaction.
    expect(txStub.insert).toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('falls back to the db client when no transaction is supplied', async () => {
    const db = makeDrizzleStub([]);
    const adapter = new ReviewOutboxAdapter(db as never);

    await adapter.scheduleReviewSubmitted(
      { quizId: 'q1', reviewId: 'r1', userId: 'u1', rating: 5 },
      null,
      '2026-07-19T00:00:00.000Z',
    );

    expect(db.insert).toHaveBeenCalled();
  });

  it('uses a deterministic idempotency key derived from (quizId, reviewId)', async () => {
    const captured: { key?: string } = {};
    const txStub = {
      insert: jest.fn(() => ({
        values: jest.fn((v: { idempotencyKey: string }) => {
          captured.key = v.idempotencyKey;
          return {
            onConflictDoNothing: jest.fn(() => Promise.resolve()),
          };
        }),
      })),
    };
    const adapter = new ReviewOutboxAdapter({} as never);

    await adapter.scheduleReviewSubmitted(
      { quizId: 'q1', reviewId: 'r1', userId: 'u1', rating: 5 },
      txStub,
      '2026-07-19T00:00:00.000Z',
    );

    expect(captured.key).toBe('review:submitted:q1:r1');
  });

  it('uses a deterministic idempotency key for review.deleted too', async () => {
    const captured: { key?: string } = {};
    const txStub = {
      insert: jest.fn(() => ({
        values: jest.fn((v: { idempotencyKey: string }) => {
          captured.key = v.idempotencyKey;
          return {
            onConflictDoNothing: jest.fn(() => Promise.resolve()),
          };
        }),
      })),
    };
    const adapter = new ReviewOutboxAdapter({} as never);

    await adapter.scheduleReviewDeleted(
      { quizId: 'q1', reviewId: 'r1' },
      txStub,
      '2026-07-19T00:00:00.000Z',
    );

    expect(captured.key).toBe('review:deleted:q1:r1');
  });
});
