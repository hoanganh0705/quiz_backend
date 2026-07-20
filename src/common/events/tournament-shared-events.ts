/**
 * Shared Tournament Events
 *
 * Cross-module event types for Tournament domain events consumed by other modules.
 * These event definitions are the canonical contract — consumers import from here,
 * not from the Tournament module internals.
 *
 * The Tournament module re-exports these types and provides an implementation of
 * SharedTournamentEventBusPort so consumers can subscribe without depending on
 * Tournament module internals.
 */

/**
 * Event emitted when a user joins a tournament.
 */
export interface SharedTournamentJoinedEvent {
  readonly eventType: 'tournament.joined';
  readonly tournamentId: string;
  readonly userId: string;
  readonly tournamentTitle: string;
  readonly timestamp: Date;
}

/**
 * Event emitted when a user withdraws from a tournament.
 */
export interface SharedTournamentParticipantWithdrawnEvent {
  readonly eventType: 'tournament.participant.withdrawn';
  readonly tournamentId: string;
  readonly userId: string;
  readonly timestamp: Date;
}

/**
 * Event emitted when a user wins a tournament (places 1st).
 */
export interface SharedTournamentWonEvent {
  readonly eventType: 'tournament.won';
  readonly tournamentId: string;
  readonly userId: string;
  readonly tournamentTitle: string;
  readonly rank: number;
  readonly timestamp: Date;
}

/**
 * Union type of all Tournament events consumed by other modules.
 * Internal-only events (starting_soon, completed, prize delivery, etc.) are excluded.
 */
export type SharedTournamentDomainEvent =
  | SharedTournamentJoinedEvent
  | SharedTournamentParticipantWithdrawnEvent
  | SharedTournamentWonEvent;

/**
 * Event bus port for cross-module Tournament events.
 *
 * Consumers inject this port to subscribe to Tournament events.
 * The Tournament module provides the implementation via SharedTournamentEventBusAdapter.
 *
 * Phase 3 / Issue #41 — the port now exposes a `publish` method in addition to
 * `subscribe`. The outbox processor calls `publish` directly to dispatch events
 * to shared bus consumers (AchievementService, SocialFeedService), replacing the
 * previous architecture where SharedTournamentEventBusAdapter subscribed to the
 * internal bus, creating a duplicate delivery path.
 */
export interface SharedTournamentEventBusPort {
  /**
   * Subscribe to Tournament domain events.
   * Returns an unsubscribe function.
   */
  subscribe(handler: (event: SharedTournamentDomainEvent) => void): () => void;

  /**
   * Publish a shared tournament event to all subscribers.
   *
   * Called directly by `TournamentOutboxProcessorService` after draining
   * events from the outbox table, replacing the previous architecture where
   * SharedTournamentEventBusAdapter subscribed to the internal bus.
   */
  publish(event: SharedTournamentDomainEvent): void;
}

export const SHARED_TOURNAMENT_EVENT_BUS = Symbol('SHARED_TOURNAMENT_EVENT_BUS');
