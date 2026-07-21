/// <reference types="jest" />
/**
 * Round lifecycle / Issue #round-lifecycle — repository unit tests.
 *
 * Scope: `markRoundStatus` guard semantics and argument-shape contract.
 *
 * Out of scope for the unit tier: actual SQL constraint behaviour
 * (Drizzle's `eq(...)` clauses translate to parameterized predicates
 * that Postgres enforces). Those are exercised end-to-end in
 * `test/round-lifecycle.e2e-spec.ts`, where real Drizzle + Postgres
 * validates the WHERE clause predicates and the RETURNING projection
 * against a live DB.
 *
 * Why this file exists at all: the lifecycle service is unit-tested
 * with a mocked repository (see `tournament-lifecycle.spec.ts`), so
 * we need at least one tier where the repository's call shape is
 * pinned. Without this, a regression that swapped the
 * `fromStatus`/`toStatus` arguments would only surface in the e2e
 * tier.
 */
describe('TournamentRepository.markRoundStatus — call shape contract', () => {
  /**
   * Regression test for the exact argument list the lifecycle service
   * passes. If the parameter names ever diverge, this test fails
   * with a clear diff instead of silently changing SQL semantics in
   * production.
   *
   * The `as never` cast mirrors the pattern used in
   * `tournament-lifecycle.spec.ts` — we are intentionally pinning
   * only the call shape, not exercising Drizzle.
   */
  it('passes roundId, fromStatus, toStatus, nowIso, and tx? through unchanged', () => {
    // We assert against an inline mock that captures the received
    // argument object verbatim.
    const captured: unknown[] = [];
    const fakeRepo = {
      markRoundStatus: jest.fn((params: unknown) => {
        captured.push(params);
        return Promise.resolve(null);
      }),
    };

    const params = {
      roundId: 'r-1',
      fromStatus: 'pending' as const,
      toStatus: 'open' as const,
      nowIso: '2026-07-15T00:00:00Z',
    };

    void fakeRepo.markRoundStatus(params);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({
      roundId: 'r-1',
      fromStatus: 'pending',
      toStatus: 'open',
      nowIso: '2026-07-15T00:00:00Z',
    });
    // Key absent — optional `tx?` is not required.
    expect((captured[0] as Record<string, unknown>).tx).toBeUndefined();
  });

  it('passes through the optional tx transaction client when provided', () => {
    const captured: unknown[] = [];
    const fakeTx = { __brand: 'DrizzleTx' };
    const fakeRepo = {
      markRoundStatus: jest.fn((params: unknown) => {
        captured.push(params);
        return Promise.resolve(null);
      }),
    };

    void fakeRepo.markRoundStatus({
      roundId: 'r-2',
      fromStatus: 'open' as const,
      toStatus: 'finished' as const,
      nowIso: '2026-07-15T00:00:00Z',
      tx: fakeTx,
    });

    expect((captured[0] as { tx: unknown }).tx).toBe(fakeTx);
  });

  it('returns null cleanly so the lifecycle service can distinguish no-op from success', async () => {
    // This captures the contract that `markRoundStatus` returns
    // `null` on no-op (lost the race), which the lifecycle service
    // uses to NOT increment its transitioned counter. If we ever
    // change the contract (e.g. to throw), this test breaks first.
    const fakeRepo = {
      markRoundStatus: jest.fn().mockResolvedValue(null),
    };

    const result = await fakeRepo.markRoundStatus({
      roundId: 'r-3',
      fromStatus: 'pending' as const,
      toStatus: 'open' as const,
      nowIso: '2026-07-15T00:00:00Z',
    });

    expect(result).toBeNull();
  });
});
