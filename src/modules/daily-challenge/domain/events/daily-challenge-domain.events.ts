/**
 * Daily-challenge domain events.
 *
 * Emitted after a daily-challenge attempt reaches terminal status
 * (`completed = true`). The XP-grant gap is closed in this phase too
 * (the design doc says "the existing XP-grant can be wired in the same
 * change since the external bus already supports it") — see the
 * producer side in `daily-challenge.application.service.ts`.
 */

export class DailyChallengeCompletedEvent {
  readonly eventType = 'daily_challenge.completed' as const;

  constructor(
    public readonly challengeId: string,
    public readonly userId: string,
    public readonly scorePercent: string,
    public readonly correctCount: number,
    public readonly totalQuestions: number,
    public readonly completedAtIso: string,
    /** Pre-baked XP reward — `rewardXp` column from `daily_challenges`. */
    public readonly rewardXp: number,
  ) {}
}

export type DailyChallengeDomainEvent = DailyChallengeCompletedEvent;
