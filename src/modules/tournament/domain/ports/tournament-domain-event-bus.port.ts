export interface TournamentDomainEventBusPort {
  publish(event: unknown): void;
}

export const TOURNAMENT_DOMAIN_EVENT_BUS = Symbol('TOURNAMENT_DOMAIN_EVENT_BUS');
