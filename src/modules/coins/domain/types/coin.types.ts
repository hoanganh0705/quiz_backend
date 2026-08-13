/**
 * Coin domain types — small shared primitives.
 *
 * Kept intentionally narrow (see design doc §9.2). The `CoinReason` enum is
 * persisted in the `coin_reason` PostgreSQL enum in
 * `src/core/database/schema/shared/enums.ts`. The TypeScript mirror here is
 * the value the application layer uses to make decisions (which listener
 * fires for which event, which amounts to read from `COIN_REWARDS`, etc.).
 *
 * `CoinSource` is the discriminator on incoming events — it tells the
 * ingestion service what kind of key to derive (per §9.5) and which cap
 * bucket to check (per §9.4).
 */

import { coinReason } from '@/core/database/schema/shared/enums';

/** Mirrors the `coin_reason` PostgreSQL enum. */
export type CoinReason = (typeof coinReason.enumValues)[number];

/**
 * The five earning surfaces that flow into the coin ingestion service.
 * Mirrors `COIN_IDEMPOTENCY_KEY_PREFIXES` for the prefix of the key.
 *
 *   - 'attempt'         → `coin:{userId}:attempt:{attemptId}`
 *   - 'daily'           → `coin:{userId}:daily:{challengeId}`
 *   - 'streak'          → `coin:{userId}:streak:{streakDays}`
 *   - 'badge'           → `coin:{userId}:badge:{badgeId}`
 *   - 'tournament'      → `coin:{userId}:tournament:{tournamentId}:{rank}`
 */
export type CoinSource = 'attempt' | 'daily' | 'streak' | 'badge' | 'tournament';

/**
 * Reasons whose earnings count toward the 200-coin daily earning cap (§9.4).
 * Streak / daily-challenge / badge rewards are once-per-milestone and
 * bypass the cap.
 */
export const DAILY_CAP_REASONS: ReadonlySet<CoinReason> = new Set<CoinReason>([
  'QUIZ_COMPLETION_REWARD',
  'QUIZ_PERFECT_BONUS',
]);
