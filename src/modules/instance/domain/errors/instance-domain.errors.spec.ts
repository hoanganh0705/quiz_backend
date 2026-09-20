import {
  InstanceNotFoundError,
  InstanceNotHostError,
  InstanceNotOpenError,
  InstanceFullError,
  InstanceAlreadyStartedError,
  InstanceAlreadyClosedError,
  InstanceAlreadyFinishedError,
  PlayerAlreadyJoinedError,
  InstanceOptimisticLockError,
  MinPlayersNotMetError,
  InstanceNotInCountdownError,
  InstanceCountdownAlreadyStartedError,
  PlayerNotInInstanceError,
  PlayerAttemptNotReadyError,
  InstanceNotRunningError,
} from './instance-domain.errors';

describe('InstanceDomainErrors', () => {
  describe('InstanceNotFoundError', () => {
    it('has code INSTANCE_NOT_FOUND', () => {
      const error = new InstanceNotFoundError();
      expect(error.code).toBe('INSTANCE_NOT_FOUND');
    });

    it('uses default message', () => {
      const error = new InstanceNotFoundError();
      expect(error.message).toBe('Quiz instance not found');
    });

    it('uses custom message when provided', () => {
      const error = new InstanceNotFoundError('Custom not found');
      expect(error.message).toBe('Custom not found');
    });
  });

  describe('InstanceNotHostError', () => {
    it('has code INSTANCE_NOT_HOST', () => {
      const error = new InstanceNotHostError();
      expect(error.code).toBe('INSTANCE_NOT_HOST');
    });
  });

  describe('InstanceNotOpenError', () => {
    it('has code INSTANCE_NOT_OPEN', () => {
      const error = new InstanceNotOpenError();
      expect(error.code).toBe('INSTANCE_NOT_OPEN');
    });
  });

  describe('InstanceFullError', () => {
    it('has code INSTANCE_FULL', () => {
      const error = new InstanceFullError();
      expect(error.code).toBe('INSTANCE_FULL');
    });
  });

  describe('InstanceAlreadyStartedError', () => {
    it('has code INSTANCE_ALREADY_STARTED', () => {
      const error = new InstanceAlreadyStartedError();
      expect(error.code).toBe('INSTANCE_ALREADY_STARTED');
    });
  });

  describe('InstanceAlreadyClosedError', () => {
    it('has code INSTANCE_ALREADY_CLOSED', () => {
      const error = new InstanceAlreadyClosedError();
      expect(error.code).toBe('INSTANCE_ALREADY_CLOSED');
    });
  });

  describe('InstanceAlreadyFinishedError', () => {
    it('has code INSTANCE_ALREADY_FINISHED', () => {
      const error = new InstanceAlreadyFinishedError();
      expect(error.code).toBe('INSTANCE_ALREADY_FINISHED');
    });
  });

  describe('PlayerAlreadyJoinedError', () => {
    it('has code PLAYER_ALREADY_JOINED', () => {
      const error = new PlayerAlreadyJoinedError();
      expect(error.code).toBe('PLAYER_ALREADY_JOINED');
    });
  });

  describe('InstanceOptimisticLockError', () => {
    it('has code INSTANCE_OPTIMISTIC_LOCK', () => {
      const error = new InstanceOptimisticLockError();
      expect(error.code).toBe('INSTANCE_OPTIMISTIC_LOCK');
    });
  });

  describe('MinPlayersNotMetError', () => {
    it('has code MIN_PLAYERS_NOT_MET', () => {
      const error = new MinPlayersNotMetError();
      expect(error.code).toBe('MIN_PLAYERS_NOT_MET');
    });
  });

  describe('InstanceNotInCountdownError', () => {
    it('has code INSTANCE_NOT_IN_COUNTDOWN', () => {
      const error = new InstanceNotInCountdownError();
      expect(error.code).toBe('INSTANCE_NOT_IN_COUNTDOWN');
    });
  });

  describe('InstanceCountdownAlreadyStartedError', () => {
    it('has code INSTANCE_COUNTDOWN_ALREADY_STARTED', () => {
      const error = new InstanceCountdownAlreadyStartedError();
      expect(error.code).toBe('INSTANCE_COUNTDOWN_ALREADY_STARTED');
    });
  });

  describe('PlayerNotInInstanceError', () => {
    it('has code PLAYER_NOT_IN_INSTANCE', () => {
      const error = new PlayerNotInInstanceError();
      expect(error.code).toBe('PLAYER_NOT_IN_INSTANCE');
    });

    it('uses default message', () => {
      const error = new PlayerNotInInstanceError();
      expect(error.message).toBe('You must join the instance before submitting an answer');
    });
  });

  describe('PlayerAttemptNotReadyError', () => {
    it('has code PLAYER_ATTEMPT_NOT_READY', () => {
      const error = new PlayerAttemptNotReadyError();
      expect(error.code).toBe('PLAYER_ATTEMPT_NOT_READY');
    });

    it('uses default message', () => {
      const error = new PlayerAttemptNotReadyError();
      expect(error.message).toBe('Your attempt is not ready — wait for the host to start the game');
    });
  });

  describe('InstanceNotRunningError', () => {
    it('has code INSTANCE_NOT_RUNNING', () => {
      const error = new InstanceNotRunningError();
      expect(error.code).toBe('INSTANCE_NOT_RUNNING');
    });

    it('uses default message', () => {
      const error = new InstanceNotRunningError();
      expect(error.message).toBe('Instance is not running');
    });
  });
});
