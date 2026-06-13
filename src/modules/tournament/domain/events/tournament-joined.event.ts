export class TournamentJoinedEvent {
  readonly eventType = 'tournament.joined' as const;

  constructor(
    public readonly tournamentId: string,
    public readonly userId: string,
    public readonly tournamentTitle: string,
    public readonly occurredAt: Date,
  ) {}
}

export class TournamentStartingSoonEvent {
  readonly eventType = 'tournament.starting_soon';

  constructor(
    public readonly userId: string,
    public readonly tournamentId: string,
    public readonly tournamentTitle: string,
    public readonly startsAt: string,
    public readonly timestamp: Date,
  ) {}
}

export class TournamentCompletedEvent {
  readonly eventType = 'tournament.completed';

  constructor(
    public readonly userId: string,
    public readonly tournamentId: string,
    public readonly tournamentTitle: string,
    public readonly rank: number,
    public readonly totalParticipants: number,
    public readonly timestamp: Date,
  ) {}
}

export class TournamentWonEvent {
  readonly eventType = 'tournament.won';

  constructor(
    public readonly userId: string,
    public readonly tournamentId: string,
    public readonly tournamentTitle: string,
    public readonly rank: number,
    public readonly prize: string | undefined,
    public readonly timestamp: Date,
  ) {}
}
