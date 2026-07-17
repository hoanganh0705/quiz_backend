import type { TournamentDomainEvent } from '../events';

export const TOURNAMENT_QUEUE_NAME = 'tournament-events';

export const TOURNAMENT_QUEUE_TOKENS = {
  CONNECTION: Symbol('TOURNAMENT_QUEUE_CONNECTION'),
  QUEUE: Symbol('TOURNAMENT_QUEUE'),
} as const;

export interface TournamentDomainEventBusPort {
  subscribe(handler: (event: TournamentDomainEvent) => void): () => void;
  publish(event: TournamentDomainEvent): Promise<void>;
}

export const TOURNAMENT_DOMAIN_EVENT_BUS = Symbol('TOURNAMENT_DOMAIN_EVENT_BUS');
