import { TOURNAMENT_THROTTLE_VALUES } from '@/core/config';
import type { TournamentThrottleConfig } from '@/core/config';

export const TOURNAMENT_THROTTLE: Readonly<TournamentThrottleConfig> = Object.freeze({
  ...TOURNAMENT_THROTTLE_VALUES,
});
