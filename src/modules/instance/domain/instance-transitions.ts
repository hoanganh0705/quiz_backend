import { PlayerTransitionError, PlayerMissingAttemptError } from './errors/instance-domain.errors';
import type { QuizInstancePlayerStatus } from '../types/instance.types';

const ALLOWED_PLAYER_TRANSITIONS: Record<QuizInstancePlayerStatus, QuizInstancePlayerStatus[]> = {
  joined: ['ready', 'disconnected'],
  ready: ['playing', 'disconnected'],
  playing: ['finished', 'disconnected'],
  disconnected: ['joined', 'ready', 'playing', 'finished'],
  finished: [],
};

export function assertInstancePlayerTransition(
  from: QuizInstancePlayerStatus,
  to: QuizInstancePlayerStatus,
): void {
  const allowed = ALLOWED_PLAYER_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new PlayerTransitionError(from, to);
  }
}

export function canTransitionInstancePlayer(
  from: QuizInstancePlayerStatus,
  to: QuizInstancePlayerStatus,
): boolean {
  return ALLOWED_PLAYER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertPlayerFinishedHasAttempt(
  playerAttemptId: string | null,
  playerId: string,
  instanceId: string,
): void {
  if (playerAttemptId === null || playerAttemptId === undefined) {
    throw new PlayerMissingAttemptError(playerId, instanceId);
  }
}
