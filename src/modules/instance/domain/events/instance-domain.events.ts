/**
 * Domain event types for the Instance aggregate.
 *
 * These events are emitted after successful state transitions in the Instance domain.
 * They are in-process events — listeners are invoked synchronously within the same request.
 *
 * Use the InstanceDomainEventBus to subscribe to these events.
 */

export class InstanceCreatedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly quizVersionId: string,
    public readonly hostUserId: string,
    public readonly maxPlayers: number | null,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.created' {
    return 'instance.created';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

export class PlayerJoinedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly userId: string,
    public readonly totalPlayers: number,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.player_joined' {
    return 'instance.player_joined';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

/**
 * Emitted when a player starts a quiz attempt inside an instance.
 * Carries the attemptId so listeners (e.g. InstanceAttemptEventBootstrapService)
 * can atomically link the attempt to the player row and transition status → 'ready'.
 */
export class PlayerAttemptStartedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly userId: string,
    public readonly attemptId: string,
    public readonly quizVersionId: string,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.player_attempt_started' {
    return 'instance.player_attempt_started';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

/**
 * Emitted when all players have finished (ready→playing→finished transition complete).
 * Used by listeners to finalize the instance state.
 */
export class PlayerFinishedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly userId: string,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.player_finished' {
    return 'instance.player_finished';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

/**
 * Emitted when a player's socket disconnects while the instance is running.
 */
export class PlayerDisconnectedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly userId: string,
    public readonly socketId: string,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.player_disconnected' {
    return 'instance.player_disconnected';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

export class InstanceStartedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly hostUserId: string,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.started' {
    return 'instance.started';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

export class InstanceClosedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly hostUserId: string,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.closed' {
    return 'instance.closed';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

/**
 * Phase 2 (Gameplay Lifecycle) — emitted on the host-driven transition
 * `open → countdown`. The application service forwards this as the
 * `countdown_started` WebSocket event so clients can render the warmup
 * timer. `countdownStartedAt` and `countdownEndsAt` are the same
 * timestamp from two perspectives (anchor vs. deadline).
 */
export class CountdownStartedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly hostUserId: string,
    public readonly countdownStartedAt: string,
    public readonly countdownEndsAt: string,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.countdown_started' {
    return 'instance.countdown_started';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

/**
 * Phase 2 (Gameplay Lifecycle) — emitted on `cancelCountdown`, the
 * `countdown → open` transition. Clients should drop their warmup UI
 * and return to the lobby. Cancellation does not delete the
 * `countdownStartedAt` until the optimistic-locking UPDATE clears it
 * alongside the status.
 */
export class CountdownCancelledEvent {
  constructor(
    public readonly instanceId: string,
    public readonly hostUserId: string,
    public readonly reason: 'host_cancelled' | 'host_disconnected' | 'instance_closed',
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.countdown_cancelled' {
    return 'instance.countdown_cancelled';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

/**
 * Phase 2 (Gameplay Lifecycle) — emitted by the scheduler when a
 * `countdown → running` transition fires after the deadline elapses.
 * Distinct from `InstanceStartedEvent` so clients and downstream
 * listeners can differentiate "the host pressed Start" from
 * "the countdown timer fired automatically".
 */
export class CountdownCompletedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly startedAt: string,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.countdown_completed' {
    return 'instance.countdown_completed';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

/**
 * Emitted when a player's attempt earns XP and the ranking has been updated.
 * Carries the XP delta so Socket.IO can push a live XP gain notification to the client.
 */
export class PlayerXpEarnedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly userId: string,
    public readonly xpEarned: number,
    public readonly newAllTimeXp: number,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.player_xp_earned' {
    return 'instance.player_xp_earned';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

export type InstanceDomainEvent =
  | InstanceCreatedEvent
  | PlayerJoinedEvent
  | PlayerAttemptStartedEvent
  | PlayerXpEarnedEvent
  | PlayerFinishedEvent
  | PlayerDisconnectedEvent
  | InstanceStartedEvent
  | InstanceClosedEvent
  | CountdownStartedEvent
  | CountdownCancelledEvent
  | CountdownCompletedEvent;
