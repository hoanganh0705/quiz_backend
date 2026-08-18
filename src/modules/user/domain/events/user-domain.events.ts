/**
 * Domain event types for the User aggregate.
 *
 * These events are emitted after successful state transitions in UserDomainService.
 * They are in-process events — listeners are invoked synchronously within the same request.
 *
 * Use the UserDomainEventBus to subscribe to these events.
 */
export class UserProfileUpdatedEvent {
  readonly eventType = 'user.profile.updated' as const;
  constructor(
    public readonly userId: string,
    public readonly changedFields: ReadonlyArray<
      'displayName' | 'bio' | 'avatarUrl' | 'avatarPublicId'
    >,
    public readonly nowIso: string,
  ) {}
}

export class UserSettingsUpdatedEvent {
  readonly eventType = 'user.settings.updated' as const;
  constructor(
    public readonly userId: string,
    public readonly nowIso: string,
  ) {}
}

/**
 * Phase 2 (F-9): Promoted from a TypeScript `interface` to a class so
 * `StreakService` can emit a real instance (matching the
 * `UserProfileUpdatedEvent` / `UserSettingsUpdatedEvent` style). The
 * `eventType` discriminator stays on the class so consumers that switch
 * on `event.eventType` continue to work, and the
 * `UserDomainEventBus.emitStreakUpdated` signature is now a proper
 * class-based contract instead of an `unknown` payload.
 */
export class UserStreakUpdatedEvent {
  readonly eventType = 'user.streak_updated' as const;
  constructor(
    public readonly userId: string,
    public readonly currentStreak: number,
    public readonly longestStreak: number,
    public readonly previousStreak: number,
    public readonly isNewRecord: boolean,
    public readonly timestamp: Date,
  ) {}
}

export type UserDomainEvent =
  | UserProfileUpdatedEvent
  | UserSettingsUpdatedEvent
  | UserStreakUpdatedEvent;
