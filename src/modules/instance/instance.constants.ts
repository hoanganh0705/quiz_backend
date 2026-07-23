export const INSTANCE_NOT_FOUND_MESSAGE = 'Quiz instance not found';
export const INSTANCE_NOT_HOST_MESSAGE = 'Only the host can perform this action';
export const INSTANCE_NOT_OPEN_MESSAGE = 'Instance is not open for joining';
export const INSTANCE_FULL_MESSAGE = 'Instance is full';
export const INSTANCE_ALREADY_STARTED_MESSAGE = 'Instance has already started';
export const INSTANCE_ALREADY_CLOSED_MESSAGE = 'Instance is already closed';
export const INSTANCE_ALREADY_FINISHED_MESSAGE = 'Instance is finished';
export const PLAYER_ALREADY_JOINED_MESSAGE = 'You have already joined this instance';
export const INSTANCE_OPTIMISTIC_LOCK_MESSAGE =
  'Instance was modified concurrently — please retry the operation';

// Phase 2 (Gameplay Lifecycle) — countdown state and minimum-player guard.
export const MIN_PLAYERS_NOT_MET_MESSAGE =
  'Instance requires at least 2 players before the host can start the countdown';
export const INSTANCE_NOT_IN_COUNTDOWN_MESSAGE = 'Instance is not in the countdown state';
export const INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE =
  'Countdown has already started for this instance';
