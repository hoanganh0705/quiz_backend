export class TournamentParticipantWithdrawnEvent {
  readonly type = 'tournament.participant.withdrawn';

  constructor(
    public readonly tournamentId: string,
    public readonly userId: string,
    public readonly withdrawnAt: Date,
  ) {}
}
