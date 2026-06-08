export type GetUpcomingTournamentsSortBy = 'startAt' | 'registrationDeadline';

export type GetUpcomingTournamentsQuery = {
  page: number;
  limit: number;
  sortBy: GetUpcomingTournamentsSortBy;
};
