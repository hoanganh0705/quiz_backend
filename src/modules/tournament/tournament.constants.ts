export const TOURNAMENT_NOT_FOUND_MESSAGE = 'Tournament not found';
export const TOURNAMENT_FORBIDDEN_MESSAGE = 'You do not have permission to manage this tournament';
export const TOURNAMENT_CONFLICT_MESSAGE = 'Tournament conflict';
export const TOURNAMENT_VALIDATION_MESSAGE = 'Tournament validation failed';
export const TOURNAMENT_REGISTRATION_CLOSED_MESSAGE = 'Tournament registration is closed';
export const TOURNAMENT_REGISTRATION_DEADLINE_PASSED_MESSAGE =
  'Tournament registration deadline has passed';
export const TOURNAMENT_FULL_MESSAGE = 'Tournament is full';
export const TOURNAMENT_ALREADY_REGISTERED_MESSAGE =
  'You are already registered for this tournament';
export const TOURNAMENT_ROUND_NOT_FOUND_MESSAGE = 'Tournament round not found';
export const TOURNAMENT_ROUND_NOT_OPEN_MESSAGE = 'Tournament round is not open';
export const TOURNAMENT_ATTEMPT_ALREADY_EXISTS_MESSAGE =
  'You have already submitted an attempt for this round';
export const TOURNAMENT_NOT_REGISTERED_MESSAGE = 'You are not registered for this tournament';
export const TOURNAMENT_UNREGISTER_CLOSED_MESSAGE =
  'Tournament unregistration is only allowed during the registration phase';
export const TOURNAMENT_ALREADY_WITHDRAWN_MESSAGE =
  'You have already withdrawn from this tournament';
export const TOURNAMENT_PARTICIPANT_STATE_ERROR_MESSAGE =
  'Invalid participant state for this operation';
export const TOURNAMENT_WITHDRAW_CLOSED_MESSAGE =
  'Tournament withdrawal is only allowed while the tournament is active';

/**
 * XP awarded to tournament winners by final rank.
 * Used by TournamentEventProcessor to dispatch XP to CommonExternalEventBus.
 */
export const TOURNAMENT_RANKING_XP_TABLE: Record<number, number> = {
  1: 500,
  2: 250,
  3: 250,
  4: 100,
  5: 100,
  6: 100,
  7: 100,
  8: 100,
  9: 100,
  10: 100,
  11: 50,
  12: 50,
  13: 50,
  14: 50,
  15: 50,
  16: 50,
  17: 50,
  18: 50,
  19: 50,
  20: 50,
  21: 50,
  22: 50,
  23: 50,
  24: 50,
  25: 50,
  26: 25,
  27: 25,
  28: 25,
  29: 25,
  30: 25,
  31: 25,
  32: 25,
  33: 25,
  34: 25,
  35: 25,
  36: 25,
  37: 25,
  38: 25,
  39: 25,
  40: 25,
  41: 25,
  42: 25,
  43: 25,
  44: 25,
  45: 25,
  46: 25,
  47: 25,
  48: 25,
  49: 25,
  50: 25,
};
