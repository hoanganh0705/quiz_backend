import { AttemptNotActiveError } from './errors';
import { ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE } from '../attempt.constants';
import type { AttemptStatus } from '../types/attempt.types';

const ALLOWED_ATTEMPT_TRANSITIONS: Record<AttemptStatus, AttemptStatus[]> = {
  started: ['completed', 'abandoned'],
  completed: [],
  abandoned: [],
};

export function assertAttemptTransition(from: AttemptStatus, to: AttemptStatus): void {
  const allowed = ALLOWED_ATTEMPT_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AttemptNotActiveError(
      `${ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE} (from=${from} to=${to})`,
    );
  }
}

export function canTransitionAttempt(from: AttemptStatus, to: AttemptStatus): boolean {
  return ALLOWED_ATTEMPT_TRANSITIONS[from]?.includes(to) ?? false;
}
