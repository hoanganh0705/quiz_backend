import type { WsThrottleOptions } from '@/common/decorators/ws-throttle.decorator';

const make = (limit: number, ttlMs: number): WsThrottleOptions => ({
  default: { limit, ttl: ttlMs },
});

export const WS_RATE_LIMITS = {
  instanceJoin: make(20, 60_000),
  instanceStartGame: make(30, 60_000),
  instanceStartCountdown: make(30, 60_000),
  instanceCancelCountdown: make(30, 60_000),
  instanceEndGame: make(30, 60_000),
  instanceQuestionRevealed: make(30, 60_000),
  instanceUpdateLeaderboard: make(30, 60_000),
  instanceAnswerSubmitted: make(60, 60_000),
} as const satisfies Record<string, WsThrottleOptions>;
