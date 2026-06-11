export class TournamentParticipantWithdrawnEvent {
  readonly eventType = 'tournament.participant.withdrawn' as const;

  constructor(
    public readonly tournamentId: string,
    public readonly userId: string,
    public readonly withdrawnAt: Date,
  ) {}
}
