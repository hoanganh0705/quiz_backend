import type {
  TournamentDifficulty,
  TournamentStatus,
  TournamentRoundStatus,
  TournamentParticipantStatus,
  TournamentCursorPayload,
} from '../../types/tournament.types';

export type { TournamentCursorPayload };

export type TournamentRow = {
  tournamentId: string;
  title: string;
  description: string | null;
  difficulty: TournamentDifficulty;
  status: TournamentStatus;
  prize: string | null;
  startAt: string;
  endAt: string;
  maxParticipants: number | null;
  categoryId: string | null;
  // Phase 1 / Issue #2 — owner column added by migration 0017.
  // Exposed on every read; `TournamentAuthorizationPolicy` consumes it.
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type TournamentDetailRow = TournamentRow & {
  categoryName: string | null;
  categorySlug: string | null;
  totalParticipants: number;
};

export type TournamentRoundRow = {
  roundId: string;
  tournamentId: string;
  roundNumber: number;
  name: string;
  description: string | null;
  quizVersionId: string;
  startAt: string | null;
  endAt: string | null;
  durationMs: number | null;
  status: TournamentRoundStatus;
  isElimination: boolean;
  participantLimit: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TournamentRoundDetailRow = TournamentRoundRow & {
  versionNumber: number;
  difficulty: TournamentDifficulty;
  durationMs: number;
  passingScorePercent: number;
  rewardXp: number;
};

export type TournamentParticipantRow = {
  participantId: string;
  tournamentId: string;
  userId: string;
  registeredAt: string;
  totalScore: number;
  totalTimeMs: number;
  rankFinal: number | null;
  status: TournamentParticipantStatus;
  withdrawnAt: string | null;
  updatedAt: string;
};

export type TournamentParticipantDetailRow = TournamentParticipantRow & {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type TournamentParticipantListItemRow = {
  userId: string;
  username: string;
  registeredAt: string;
};

export type TournamentStandingRow = {
  rank: number;
  score: number;
  percentile: number;
  participantCount: number;
};

export type UpcomingTournamentRow = {
  tournamentId: string;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  participantCount: number;
};

export type ActiveTournamentRow = {
  tournamentId: string;
  name: string;
  startAt: string;
  endAt: string;
  participantCount: number;
};

export type CompletedTournamentRow = {
  tournamentId: string;
  name: string;
  startAt: string;
  endAt: string;
  participantCount: number;
};

export type RelatedTournamentRow = {
  tournamentId: string;
  name: string;
  startAt: string;
  participantCount: number;
};

export type TournamentStatsRow = {
  tournamentId: string;
  participants: number;
  completedParticipants: number;
  averageScore: number;
  highestScore: number | null;
  lowestScore: number | null;
  completionRate: number;
  averageRank: number | null;
  startedAt: string;
  endedAt: string;
};

export type TournamentRoundParticipantRow = {
  roundParticipantId: string;
  roundId: string;
  participantId: string;
  attemptId: string | null;
  joinedAt: string;
  roundScore: number;
  roundTimeMs: number;
  rankInRound: number | null;
  isQualified: boolean;
  updatedAt: string;
};

export type TournamentLeaderboardEntry = TournamentParticipantDetailRow & {
  rank: number;
};

export type TournamentWinnerRow = {
  rank: number;
  userId: string;
  username: string;
  score: number;
  avatarUrl: string | null;
};

export type TournamentListFilters = {
  status?: TournamentStatus;
  difficulty?: TournamentDifficulty;
  categoryId?: string;
};

export type FinalizedTournamentParticipantRow = {
  userId: string;
  rank: number;
  totalParticipants: number;
};

export interface TournamentRepositoryPort {
  getTournamentById(tournamentId: string): Promise<TournamentRow | null>;

  getTournamentDetailById(tournamentId: string): Promise<TournamentDetailRow | null>;

  listTournaments(params: {
    limit: number;
    cursor?: TournamentCursorPayload | null;
    filters?: TournamentListFilters;
  }): Promise<TournamentRow[]>;

  createTournament(params: {
    title: string;
    description: string | null;
    difficulty: TournamentDifficulty;
    prize: string | null;
    startAt: string;
    endAt: string;
    maxParticipants: number | null;
    categoryId: string | null;
    /**
     * Phase 1 / Issue #2 — the user creating the tournament. Becomes
     * `tournaments.owner_user_id`; required by the application-layer
     * authorization policy for the new admin endpoints
     * (`PATCH /:id`, `DELETE /:id`, `POST /:id/cancel`).
     */
    ownerUserId: string;
    nowIso: string;
  }): Promise<{ tournamentId: string }>;

  /**
   * Phase 1 / Issue #1 — partial update for `PATCH /tournaments/:id`.
   *
   * Only the fields that are explicitly listed in `params` are
   * touched; `undefined` means "leave alone". The service layer is
   * the source of truth for which fields are editable in which
   * tournament status — the repository treats `undefined` as a
   * no-op.
   *
   * Returns the updated row. Returns `null` when the row no longer
   * exists (it was soft-deleted between the caller's `SELECT` and
   * the `UPDATE`) — the service maps `null` to
   * `TournamentNotFoundError`.
   */
  updateTournament(params: {
    tournamentId: string;
    title?: string;
    description?: string | null;
    difficulty?: TournamentDifficulty;
    prize?: string | null;
    startAt?: string;
    endAt?: string;
    maxParticipants?: number | null;
    categoryId?: string | null;
    nowIso: string;
  }): Promise<TournamentRow | null>;

  /**
   * Phase 1 / Issue #1 — soft delete for `DELETE /tournaments/:id`.
   *
   * Writes `deleted_at = nowIso()` and `updated_at = nowIso()` only
   * when the row is currently live (`deleted_at IS NULL`); rows that
   * are already soft-deleted are returned unchanged so the second
   * `DELETE` in a row is idempotent at the repository layer.
   *
   * Returns the post-mutation row, or `null` if the row does not
   * exist.
   */
  softDeleteTournament(params: {
    tournamentId: string;
    nowIso: string;
  }): Promise<TournamentRow | null>;

  /**
   * Phase 1 / Issue #1 — cancel transition for `POST /tournaments/:id/cancel`.
   *
   * Writes `status = 'cancelled'` and `updated_at = nowIso()` only
   * when the row is currently in `upcoming` or `registration`. Rows
   * already in `ongoing` / `finished` / `cancelled` are returned
   * unchanged so callers can distinguish "the cancel was a no-op"
   * (return value reflects unchanged `status`) from "the row is
   * gone" (`null`).
   *
   * Returns the post-mutation row.
   */
  cancelTournament(params: { tournamentId: string; nowIso: string }): Promise<TournamentRow | null>;

  getParticipant(participantId: string): Promise<TournamentParticipantRow | null>;

  getParticipantByUserAndTournament(
    userId: string,
    tournamentId: string,
  ): Promise<TournamentParticipantRow | null>;

  registerParticipant(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
  }): Promise<TournamentParticipantRow>;

  withdrawParticipant(participantId: string, nowIso: string): Promise<TournamentParticipantRow>;

  reactivateParticipant(participantId: string, nowIso: string): Promise<TournamentParticipantRow>;

  getRoundById(roundId: string): Promise<TournamentRoundRow | null>;

  getRoundDetailById(roundId: string): Promise<TournamentRoundDetailRow | null>;

  getRoundsByTournament(tournamentId: string): Promise<TournamentRoundRow[]>;

  getRoundParticipant(
    roundId: string,
    participantId: string,
  ): Promise<TournamentRoundParticipantRow | null>;

  createRoundParticipant(params: {
    roundId: string;
    participantId: string;
    nowIso: string;
  }): Promise<TournamentRoundParticipantRow>;

  getLeaderboard(tournamentId: string): Promise<TournamentLeaderboardEntry[]>;

  getWinners(params: { tournamentId: string; limit: number }): Promise<TournamentWinnerRow[]>;

  listParticipants(params: {
    tournamentId: string;
    page: number;
    limit: number;
  }): Promise<{ items: TournamentParticipantListItemRow[]; total: number }>;

  getParticipantStanding(params: {
    tournamentId: string;
    userId: string;
  }): Promise<TournamentStandingRow | null>;

  listUpcomingTournaments(params: {
    page: number;
    limit: number;
    sortBy: 'startAt' | 'registrationDeadline';
    nowIso: string;
  }): Promise<{ items: UpcomingTournamentRow[]; total: number }>;

  listActiveTournaments(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: ActiveTournamentRow[]; total: number }>;

  listCompletedTournaments(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: CompletedTournamentRow[]; total: number }>;

  listRelatedTournaments(params: {
    tournamentId: string;
    limit: number;
  }): Promise<RelatedTournamentRow[]>;

  getTournamentStats(tournamentId: string): Promise<TournamentStatsRow>;

  countParticipants(tournamentId: string): Promise<number>;

  listTournamentsStartingSoon(params: {
    windowStartIso: string;
    windowEndIso: string;
  }): Promise<TournamentRow[]>;

  markTournamentStatus(params: {
    tournamentId: string;
    fromStatus: TournamentStatus;
    toStatus: TournamentStatus;
    nowIso: string;
  }): Promise<TournamentRow | null>;

  finalizeTournament(params: {
    tournamentId: string;
    nowIso: string;
  }): Promise<FinalizedTournamentParticipantRow[]>;

  /**
   * Atomically creates a round participant and its associated quiz attempt
   * within a single database transaction.
   */
  startRoundAttemptTx(params: {
    roundId: string;
    participantId: string;
    userId: string;
    quizVersionId: string;
    tournamentId: string;
    nowIso: string;
  }): Promise<{ attemptId: string; roundParticipant: TournamentRoundParticipantRow }>;

  /**
   * Creates a quiz attempt for an existing round participant and links it back
   * to the round participant — all within a single transaction.
   */
  createAttemptForRound(params: {
    userId: string;
    quizVersionId: string;
    tournamentId: string;
    roundId: string;
    roundParticipantId: string;
    nowIso: string;
  }): Promise<{ attemptId: string }>;

  /**
   * Recomputes `tournament_participants.total_score` and
   * `tournament_participants.total_time_ms` from the matching rows in
   * `tournament_round_participants` (SUM(round_score), SUM(round_time_ms))
   * and writes the result back to the participant in a single UPDATE.
   *
   * Acts as the recompute primitive for Fix #1 of
   * docs/plans/denormalized-counters-audit.md: it makes the denormalized
   * columns a pure projection of their source of truth, idempotent and
   * safe to call after every round-participant write or on a schedule.
   *
   * When `tx` is provided the recompute is executed inside that transaction
   * (so callers can compose it with their own round-participant write).
   * Otherwise the method runs in its own implicit transaction.
   */
  recalculateParticipantTotals(participantId: string, tx?: unknown): Promise<void>;

  /**
   * Bulk variant of `recalculateParticipantTotals` that re-runs the same
   * two-pass UPDATE as the 0008 migration, across every tournament
   * participant. Intended for the daily cron on
   * `TournamentSchedulerService` to repair drift that may have
   * accumulated between scheduled recomputes.
   *
   * Returns the number of participant rows whose totals changed.
   */
  reconcileAllParticipantTotals(): Promise<{ updated: number }>;
}

export const TOURNAMENT_REPOSITORY_PORT = Symbol('TOURNAMENT_REPOSITORY_PORT');
