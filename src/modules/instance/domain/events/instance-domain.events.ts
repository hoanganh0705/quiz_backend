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
  | InstanceClosedEvent;
