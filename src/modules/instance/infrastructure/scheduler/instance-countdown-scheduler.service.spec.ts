/**
 * Regression guard for the Phase 2 countdown scheduler.
 *
 * The scheduler's previous `findDueCountdowns` query used
 * `countdown_started_at <= nowIso` directly, which matches every
 * active countdown row regardless of whether the
 * `COUNTDOWN_DURATION_MS` warmup window has elapsed. The intended
 * predicate (documented on `InstanceService.COUNTDOWN_DURATION_MS`)
 * is `countdown_started_at + COUNTDOWN_DURATION_MS <= nowIso`, i.e.
 * the scheduler should only fire for rows whose 5-second window has
 * actually expired.
 *
 * The application-side fix lives in
 * `InstanceCountdownSchedulerService.handleDueCountdowns`, which
 * subtracts `InstanceService.COUNTDOWN_DURATION_MS` from `nowIso`
 * before passing it to `findDueCountdowns`. We assert that the
 * value passed to the repository matches
 * `Date.now() - COUNTDOWN_DURATION_MS` (within a small tolerance to
 * absorb the wall-clock drift between the two `Date.now()` reads).
 */
import { InstanceCountdownSchedulerService } from './instance-countdown-scheduler.service';
import { InstanceService } from '../../domain/instance.service';
import type { QuizInstanceRepositoryPort } from '../../domain/ports';

describe('InstanceCountdownSchedulerService — Phase 2 cutoff guard', () => {
  const COUNTDOWN_MS = InstanceService.COUNTDOWN_DURATION_MS;

  const buildService = (
    findDueCountdowns: jest.Mock,
    completeCountdownByScheduler: jest.Mock = jest.fn().mockResolvedValue({ completed: true }),
  ) => {
    const instanceRepository = { findDueCountdowns } as unknown as QuizInstanceRepositoryPort;
    const instanceService = {
      completeCountdownByScheduler,
    } as unknown as InstanceService;
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    return {
      service: new InstanceCountdownSchedulerService(
        instanceService,
        instanceRepository,
        logger as never,
      ),
      instanceRepository,
    };
  };

  it('subtracts COUNTDOWN_DURATION_MS from nowIso before calling findDueCountdowns', async () => {
    const findDueCountdowns = jest.fn().mockResolvedValue([]);
    const { service } = buildService(findDueCountdowns);

    const beforeMs = Date.now();
    await service.handleDueCountdowns();
    const afterMs = Date.now();

    expect(findDueCountdowns).toHaveBeenCalledTimes(1);
    const arg = findDueCountdowns.mock.calls[0][0];
    expect(arg.limit).toBe(InstanceCountdownSchedulerService.TICK_BATCH_SIZE);

    const cutoffMs = new Date(arg.nowIso).getTime();
    // The cutoff must be at least COUNTDOWN_DURATION_MS in the past
    // relative to both wall-clock samples. Allow a small slack so the
    // assertion is stable across fast CI runs.
    const expectedMin = beforeMs - COUNTDOWN_MS - 100;
    const expectedMax = afterMs - COUNTDOWN_MS + 100;
    expect(cutoffMs).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoffMs).toBeLessThanOrEqual(expectedMax);
  });

  it('does NOT advance a countdown whose warmup window has not yet elapsed', async () => {
    // The bug regression: with the original query
    //   `countdown_started_at <= nowIso`,
    // the scheduler picked up every active countdown row within one
    // second of `startCountdown`, racing the host's manual
    // `startInstance` / `cancelCountdown`. After the fix the
    // scheduler's `cutoffIso` is in the past by `COUNTDOWN_DURATION_MS`,
    // so a row whose `countdown_started_at` is `now - 1s` is younger
    // than the cutoff and the repository returns no rows.
    const findDueCountdowns = jest.fn().mockResolvedValue([]);
    const { service } = buildService(findDueCountdowns);

    await service.handleDueCountdowns();

    // The repository was given a cutoff that is `COUNTDOWN_DURATION_MS`
    // older than `nowIso`. A countdown started 1 second ago has
    // `countdown_started_at = now - 1s`, which is greater than the
    // cutoff `now - 5s`, so `lte` is false and the row is excluded.
    const arg = findDueCountdowns.mock.calls[0][0];
    const cutoffMs = new Date(arg.nowIso).getTime();
    const oneSecondOldCountdownMs = Date.now() - 1_000;
    expect(oneSecondOldCountdownMs).toBeGreaterThan(cutoffMs);
  });
});

