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

export class PlayerAnsweredEvent {
  constructor(
    public readonly instanceId: string,
    public readonly userId: string,
    public readonly attemptId: string,
    public readonly questionId: string,
    public readonly selectedOptionId: string | null,
    public readonly timeTakenMs: number,
    public readonly isCorrect: boolean | null,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'instance.player_answered' {
    return 'instance.player_answered';
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
  | PlayerAnsweredEvent
  | InstanceStartedEvent
  | InstanceClosedEvent
  | CountdownStartedEvent
  | CountdownCancelledEvent
  | CountdownCompletedEvent;
