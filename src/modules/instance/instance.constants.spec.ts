import {
  INSTANCE_NOT_FOUND_MESSAGE,
  INSTANCE_NOT_HOST_MESSAGE,
  INSTANCE_NOT_OPEN_MESSAGE,
  INSTANCE_FULL_MESSAGE,
  INSTANCE_ALREADY_STARTED_MESSAGE,
  INSTANCE_ALREADY_CLOSED_MESSAGE,
  INSTANCE_ALREADY_FINISHED_MESSAGE,
  PLAYER_ALREADY_JOINED_MESSAGE,
  INSTANCE_OPTIMISTIC_LOCK_MESSAGE,
  MIN_PLAYERS_NOT_MET_MESSAGE,
  INSTANCE_NOT_IN_COUNTDOWN_MESSAGE,
  INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE,
  INSTANCE_NOT_RUNNING_MESSAGE,
  PLAYER_NOT_IN_INSTANCE_MESSAGE,
  PLAYER_ATTEMPT_NOT_READY_MESSAGE,
  INSTANCE_STATUSES,
} from './instance.constants';

describe('instance constants', () => {
  describe('INSTANCE_STATUSES', () => {
    it('contains all expected instance statuses', () => {
      expect(INSTANCE_STATUSES).toContain('open');
      expect(INSTANCE_STATUSES).toContain('countdown');
      expect(INSTANCE_STATUSES).toContain('running');
      expect(INSTANCE_STATUSES).toContain('closed');
      expect(INSTANCE_STATUSES).toContain('finished');
    });

    it('has exactly 5 statuses', () => {
      expect(INSTANCE_STATUSES).toHaveLength(5);
    });
  });

  describe('error messages', () => {
    it('INSTANCE_NOT_FOUND_MESSAGE is defined', () => {
      expect(INSTANCE_NOT_FOUND_MESSAGE).toBe('Quiz instance not found');
    });

    it('INSTANCE_NOT_HOST_MESSAGE is defined', () => {
      expect(INSTANCE_NOT_HOST_MESSAGE).toBe('Only the host can perform this action');
    });

    it('INSTANCE_NOT_OPEN_MESSAGE is defined', () => {
      expect(INSTANCE_NOT_OPEN_MESSAGE).toBe('Instance is not open for joining');
    });

    it('INSTANCE_FULL_MESSAGE is defined', () => {
      expect(INSTANCE_FULL_MESSAGE).toBe('Instance is full');
    });

    it('INSTANCE_ALREADY_STARTED_MESSAGE is defined', () => {
      expect(INSTANCE_ALREADY_STARTED_MESSAGE).toBe('Instance has already started');
    });

    it('INSTANCE_ALREADY_CLOSED_MESSAGE is defined', () => {
      expect(INSTANCE_ALREADY_CLOSED_MESSAGE).toBe('Instance is already closed');
    });

    it('INSTANCE_ALREADY_FINISHED_MESSAGE is defined', () => {
      expect(INSTANCE_ALREADY_FINISHED_MESSAGE).toBe('Instance is finished');
    });

    it('PLAYER_ALREADY_JOINED_MESSAGE is defined', () => {
      expect(PLAYER_ALREADY_JOINED_MESSAGE).toBe('You have already joined this instance');
    });

    it('INSTANCE_OPTIMISTIC_LOCK_MESSAGE is defined', () => {
      expect(INSTANCE_OPTIMISTIC_LOCK_MESSAGE).toBe(
        'Instance was modified concurrently — please retry the operation',
      );
    });

    it('MIN_PLAYERS_NOT_MET_MESSAGE is defined', () => {
      expect(MIN_PLAYERS_NOT_MET_MESSAGE).toBe(
        'Instance requires at least 2 players before the host can start the countdown',
      );
    });

    it('INSTANCE_NOT_IN_COUNTDOWN_MESSAGE is defined', () => {
      expect(INSTANCE_NOT_IN_COUNTDOWN_MESSAGE).toBe('Instance is not in the countdown state');
    });

    it('INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE is defined', () => {
      expect(INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE).toBe(
        'Countdown has already started for this instance',
      );
    });

    it('INSTANCE_NOT_RUNNING_MESSAGE is defined', () => {
      expect(INSTANCE_NOT_RUNNING_MESSAGE).toBe('Instance is not running');
    });

    it('PLAYER_NOT_IN_INSTANCE_MESSAGE is defined', () => {
      expect(PLAYER_NOT_IN_INSTANCE_MESSAGE).toBe(
        'You must join the instance before submitting an answer',
      );
    });

    it('PLAYER_ATTEMPT_NOT_READY_MESSAGE is defined', () => {
      expect(PLAYER_ATTEMPT_NOT_READY_MESSAGE).toBe(
        'Your attempt is not ready — wait for the host to start the game',
      );
    });
  });
});
