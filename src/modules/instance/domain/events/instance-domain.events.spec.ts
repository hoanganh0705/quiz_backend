import {
  InstanceCreatedEvent,
  PlayerJoinedEvent,
  PlayerAttemptStartedEvent,
  PlayerFinishedEvent,
  PlayerDisconnectedEvent,
  PlayerAnsweredEvent,
  InstanceStartedEvent,
  InstanceClosedEvent,
  CountdownStartedEvent,
  CountdownCancelledEvent,
  CountdownCompletedEvent,
  PlayerXpEarnedEvent,
} from './instance-domain.events';

describe('InstanceDomainEvents', () => {
  describe('InstanceCreatedEvent', () => {
    it('has correct eventType', () => {
      const event = new InstanceCreatedEvent(
        'inst-1',
        'ver-1',
        'user-1',
        10,
        '2025-01-01T00:00:00Z',
      );
      expect(event.eventType).toBe('instance.created');
    });

    it('exposes all constructor arguments', () => {
      const event = new InstanceCreatedEvent(
        'inst-1',
        'ver-1',
        'user-1',
        10,
        '2025-01-01T00:00:00Z',
      );
      expect(event.instanceId).toBe('inst-1');
      expect(event.quizVersionId).toBe('ver-1');
      expect(event.hostUserId).toBe('user-1');
      expect(event.maxPlayers).toBe(10);
      expect(event.nowIso).toBe('2025-01-01T00:00:00Z');
    });

    it('returns a Date for timestamp', () => {
      const event = new InstanceCreatedEvent(
        'inst-1',
        'ver-1',
        'user-1',
        10,
        '2025-01-01T00:00:00Z',
      );
      expect(event.timestamp).toEqual(new Date('2025-01-01T00:00:00Z'));
    });
  });

  describe('PlayerJoinedEvent', () => {
    it('has correct eventType', () => {
      const event = new PlayerJoinedEvent('inst-1', 'user-1', 5, '2025-01-01T00:00:00Z');
      expect(event.eventType).toBe('instance.player_joined');
    });

    it('exposes all constructor arguments', () => {
      const event = new PlayerJoinedEvent('inst-1', 'user-1', 5, '2025-01-01T00:00:00Z');
      expect(event.instanceId).toBe('inst-1');
      expect(event.userId).toBe('user-1');
      expect(event.totalPlayers).toBe(5);
    });
  });

  describe('PlayerAttemptStartedEvent', () => {
    it('has correct eventType', () => {
      const event = new PlayerAttemptStartedEvent(
        'inst-1',
        'user-1',
        'att-1',
        'ver-1',
        '2025-01-01T00:00:00Z',
      );
      expect(event.eventType).toBe('instance.player_attempt_started');
    });
  });

  describe('PlayerFinishedEvent', () => {
    it('has correct eventType', () => {
      const event = new PlayerFinishedEvent('inst-1', 'user-1', '2025-01-01T00:00:00Z');
      expect(event.eventType).toBe('instance.player_finished');
    });
  });

  describe('PlayerDisconnectedEvent', () => {
    it('has correct eventType', () => {
      const event = new PlayerDisconnectedEvent(
        'inst-1',
        'user-1',
        'sock-1',
        '2025-01-01T00:00:00Z',
      );
      expect(event.eventType).toBe('instance.player_disconnected');
    });
  });

  describe('PlayerAnsweredEvent', () => {
    it('has correct eventType', () => {
      const event = new PlayerAnsweredEvent(
        'inst-1',
        'user-1',
        'att-1',
        'q-1',
        'opt-1',
        5000,
        null,
        '2025-01-01T00:00:00Z',
      );
      expect(event.eventType).toBe('instance.player_answered');
    });

    it('exposes all constructor arguments', () => {
      const event = new PlayerAnsweredEvent(
        'inst-1',
        'user-1',
        'att-1',
        'q-1',
        'opt-1',
        5000,
        null,
        '2025-01-01T00:00:00Z',
      );
      expect(event.instanceId).toBe('inst-1');
      expect(event.userId).toBe('user-1');
      expect(event.attemptId).toBe('att-1');
      expect(event.questionId).toBe('q-1');
      expect(event.selectedOptionId).toBe('opt-1');
      expect(event.timeTakenMs).toBe(5000);
      expect(event.isCorrect).toBeNull();
    });
  });

  describe('InstanceStartedEvent', () => {
    it('has correct eventType', () => {
      const event = new InstanceStartedEvent('inst-1', 'user-1', '2025-01-01T00:00:00Z');
      expect(event.eventType).toBe('instance.started');
    });
  });

  describe('InstanceClosedEvent', () => {
    it('has correct eventType', () => {
      const event = new InstanceClosedEvent('inst-1', 'user-1', '2025-01-01T00:00:00Z');
      expect(event.eventType).toBe('instance.closed');
    });
  });

  describe('CountdownStartedEvent', () => {
    it('has correct eventType', () => {
      const event = new CountdownStartedEvent(
        'inst-1',
        'user-1',
        '2025-01-01T00:00:00Z',
        '2025-01-01T00:00:30Z',
        '2025-01-01T00:00:00Z',
      );
      expect(event.eventType).toBe('instance.countdown_started');
    });
  });

  describe('CountdownCancelledEvent', () => {
    it('has correct eventType', () => {
      const event = new CountdownCancelledEvent(
        'inst-1',
        'user-1',
        'host_cancelled',
        '2025-01-01T00:00:00Z',
      );
      expect(event.eventType).toBe('instance.countdown_cancelled');
    });

    it('exposes reason', () => {
      const event = new CountdownCancelledEvent(
        'inst-1',
        'user-1',
        'host_disconnected',
        '2025-01-01T00:00:00Z',
      );
      expect(event.reason).toBe('host_disconnected');
    });
  });

  describe('CountdownCompletedEvent', () => {
    it('has correct eventType', () => {
      const event = new CountdownCompletedEvent(
        'inst-1',
        '2025-01-01T00:00:00Z',
        '2025-01-01T00:00:30Z',
      );
      expect(event.eventType).toBe('instance.countdown_completed');
    });
  });

  describe('PlayerXpEarnedEvent', () => {
    it('has correct eventType', () => {
      const event = new PlayerXpEarnedEvent('inst-1', 'user-1', 100, 500, '2025-01-01T00:00:00Z');
      expect(event.eventType).toBe('instance.player_xp_earned');
    });
  });
});
