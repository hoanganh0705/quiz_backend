export interface SharedTournamentJoinedEvent {
  readonly eventType: 'tournament.joined';
  readonly tournamentId: string;
  readonly userId: string;
  readonly tournamentTitle: string;
  readonly timestamp: Date;
}

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

export type SharedTournamentDomainEvent =
  | SharedTournamentJoinedEvent
  | SharedTournamentParticipantWithdrawnEvent
  | SharedTournamentWonEvent;

export interface SharedTournamentEventBusPort {
  subscribe(handler: (event: SharedTournamentDomainEvent) => void): () => void;

  publish(event: SharedTournamentDomainEvent): void;
}

export const SHARED_TOURNAMENT_EVENT_BUS = Symbol('SHARED_TOURNAMENT_EVENT_BUS');
