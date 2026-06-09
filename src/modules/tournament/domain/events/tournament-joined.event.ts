export class TournamentParticipantWithdrawnEvent {
  readonly type = 'tournament.participant.withdrawn';

  constructor(
    public readonly tournamentId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}

export class TournamentJoinedEvent {
  readonly type = 'tournament.joined';

  constructor(
    public readonly tournamentId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
