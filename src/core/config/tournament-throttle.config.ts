export const TOURNAMENT_THROTTLE_VALUES = {
  createTournament: { limit: 10, ttl: 60_000 },
  createRound: { limit: 20, ttl: 60_000 },
  updateTournament: { limit: 20, ttl: 60_000 },
  cancelTournament: { limit: 10, ttl: 60_000 },
  softDeleteTournament: { limit: 5, ttl: 60_000 },
  registerForTournament: { limit: 30, ttl: 60_000 },
  unregisterFromTournament: { limit: 30, ttl: 60_000 },
  withdrawFromTournament: { limit: 10, ttl: 60_000 },
  startRoundAttempt: { limit: 30, ttl: 60_000 },
  listTournaments: { limit: 120, ttl: 60_000 },
  getUpcomingTournaments: { limit: 120, ttl: 60_000 },
  getActiveTournaments: { limit: 120, ttl: 60_000 },
  getCompletedTournaments: { limit: 120, ttl: 60_000 },
  getTournamentById: { limit: 240, ttl: 60_000 },
  getTournamentStats: { limit: 120, ttl: 60_000 },
  getTournamentWinners: { limit: 120, ttl: 60_000 },
  getRelatedTournaments: { limit: 120, ttl: 60_000 },
  getTournamentParticipants: { limit: 120, ttl: 60_000 },
  getTournamentLeaderboard: { limit: 240, ttl: 60_000 },
  getMyTournamentStanding: { limit: 120, ttl: 60_000 },
} as const;

export type TournamentThrottleConfig = typeof TOURNAMENT_THROTTLE_VALUES;
