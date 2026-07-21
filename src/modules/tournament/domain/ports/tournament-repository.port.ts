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

  withdrawParticipant(
    participantId: string,
    nowIso: string,
    tx?: unknown,
  ): Promise<TournamentParticipantRow>;

  reactivateParticipant(participantId: string, nowIso: string): Promise<TournamentParticipantRow>;

  /**
   * Phase 2 / Issues #3, #4 — atomic tournament registration.
   *
   * Replaces the read-then-write pattern in `registerForTournament`
   * with a single transaction that:
   *
   *   1. Locks the tournament row with `SELECT … FOR UPDATE` to
   *      prevent concurrent capacity-check races.
   *   2. Counts active participants (now fully consistent inside the lock).
   *   3. Upserts the participant row with `ON CONFLICT DO NOTHING` so
   *      concurrent duplicate registrations resolve cleanly rather than
   *      throwing a 500.
   *   4. If nothing was inserted (user already registered / withdrawn),
   *      re-reads and returns the existing row.
   *
   * The capacity check runs inside the row lock so two concurrent
   * registrations when `count == max - 1` cannot both succeed — the
   * second transaction blocks on the FOR UPDATE and sees the correct
   * post-insert count.
   *
   * The `ON CONFLICT DO NOTHING` makes re-registration idempotent at
   * the DB level; the return value disambiguates "inserted fresh"
   * from "already active / withdrawn" for the service layer.
   *
   * Throws `TournamentFullError` (via the service) when the cap
   * would be exceeded. Throws nothing when the user is already
   * registered (service maps `null` return → `TournamentAlreadyRegisteredError`).
   *
   * Returns `{ participant, inserted }` where `inserted` is `true`
   * when the participant row was freshly created, allowing the
   * service to distinguish a first-time registration from an
   * idempotent re-entry (for event publishing decisions).
   */
  atomicRegister(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
    /** Optional transaction client. When provided, the operation joins the caller's transaction. */
    tx?: unknown;
  }): Promise<{ participant: TournamentParticipantRow; inserted: boolean }>;

  /**
   * Phase 2 / Issue #2 (part 2) — atomic tournament withdrawal.
   *
   * Replaces the read-then-write pattern in `unregisterFromTournament`
   * with a single transaction that:
   *
   *   1. Locks the tournament row with `SELECT … FOR UPDATE`.
   *   2. Conditionally updates the participant to `status='withdrawn'`
   *      only when the participant exists and is currently `active`.
   *
   * This prevents the TOCTOU race where a concurrent re-registration
   * arrives while a withdrawal is in-flight: the withdrawal blocks
   * on the FOR UPDATE, sees the participant in `active` state, and
   * updates it to `withdrawn`. The re-registration then sees the
   * withdrawn row and re-activates it correctly.
   *
   * Returns the updated participant row, or `null` when no active
   * participant exists for this (user, tournament) pair. The service
   * maps `null` → `TournamentNotRegisteredError`.
   */
  atomicWithdraw(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
    /** Optional transaction client. When provided, the operation joins the caller's transaction. */
    tx?: unknown;
  }): Promise<TournamentParticipantRow | null>;

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

  // Issue #28: Added pagination to prevent unbounded responses.
  getLeaderboard(params: {
    tournamentId: string;
    limit: number;
    offset: number;
  }): Promise<{ items: TournamentLeaderboardEntry[]; total: number }>;

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

  /**
   * Lists tournaments that are in `registration` status and have passed their
   * `start_at`. Used by `TournamentLifecycleService.startDueTournaments` to
   * drive the `registration → ongoing` transition.
   *
   * Does NOT filter by a date window — every `registration` tournament whose
   * `start_at` has elapsed is eligible, regardless of how late the scheduler
   * tick runs.
   */
  listTournamentsStartingPlay(params: { nowIso: string }): Promise<TournamentRow[]>;

  markTournamentStatus(params: {
    tournamentId: string;
    fromStatus: TournamentStatus;
    toStatus: TournamentStatus;
    nowIso: string;
    /** Optional transaction client. When provided, the operation joins the caller's transaction. */
    tx?: unknown;
  }): Promise<TournamentRow | null>;

  /**
   * Round lifecycle / Issue #round-lifecycle — list rounds whose
   * `start_at` is at or before `nowIso` AND whose parent tournament is
   * currently `ongoing`. Status filter is applied at the SQL level so
   * the lifecycle service iterates only over candidates that need a
   * transition. Pagination is page/limit so the caller can loop until
   * empty (mirrors `listCompletedTournaments`).
   *
   * Returns the page of `TournamentRoundRow` items in
   * `start_at ASC, round_id ASC` order (longest-waiting first).
   */
  listDueRoundOpens(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: TournamentRoundRow[]; total: number }>;

  /**
   * Round lifecycle / Issue #round-lifecycle — list rounds whose
   * `end_at` is at or before `nowIso`. The parent tournament's status
   * is intentionally not constrained: a round whose tournament
   * transitioned `ongoing → finished` mid-round still closes on its
   * own `end_at`.
   *
   * Returns the page of `TournamentRoundRow` items in
   * `end_at ASC, round_id ASC` order.
   */
  listDueRoundCloses(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: TournamentRoundRow[]; total: number }>;

  /**
   * Round lifecycle / Issue #round-lifecycle — guarded state
   * transition for `tournament_rounds.status`. Mirrors
   * `markTournamentStatus` exactly: writes `status = toStatus` only
   * when the current status equals `fromStatus`, and returns the
   * post-mutation row (or `null` when no row matched — e.g., a
   * concurrent caller already advanced the round).
   *
   * The optional `tx?` parameter is reserved for future transactional
   * composition. Today's lifecycle service does not need it (single
   * guarded UPDATE is sufficient and matches the tournament
   * equivalent), but the slot is kept open so callers can compose
   * the transition with a downstream write later without changing
   * the lifecycle method signature.
   */
  markRoundStatus(params: {
    roundId: string;
    fromStatus: TournamentRoundStatus;
    toStatus: TournamentRoundStatus;
    nowIso: string;
    /** Optional transaction client. When provided, the operation joins the caller's transaction. */
    tx?: unknown;
  }): Promise<TournamentRoundRow | null>;

  finalizeTournament(params: {
    tournamentId: string;
    nowIso: string;
    /** Optional transaction client. When provided, the operation joins the caller's transaction. */
    tx?: unknown;
  }): Promise<FinalizedTournamentParticipantRow[]>;

  /**
   * Phase 2 / Issues #6, #50 — atomic round-start with idempotency.
   *
   * Atomically inserts the round_participant row (with `ON CONFLICT DO NOTHING`
   * for idempotency), then creates the quiz_attempt and links it back.
   *
   * The service layer performs the pre-Tx `tournamentId` cross-check and
   * the pre-Tx `existingRoundParticipant?.attemptId` check; this method
   * provides the idempotency guarantee inside the transaction.
   *
   * Returns `attemptId`, `roundParticipant` (with `attemptId` set), and
   * `inserted` (whether the round_participant row was freshly inserted).
   */
  startRoundAttemptTx(params: {
    roundId: string;
    participantId: string;
    userId: string;
    quizVersionId: string;
    tournamentId: string;
    nowIso: string;
  }): Promise<{
    attemptId: string;
    roundParticipant: TournamentRoundParticipantRow;
    inserted: boolean;
  }>;

  /**
   * Phase 2 / Issues #6, #50 — atomic attempt creation with idempotency.
   *
   * Used when a round_participant row already exists but has no `attemptId`.
   * The service calls this after confirming (via a pre-Tx read) that
   * `existingRoundParticipant` has no attempt yet.
   *
   * Internally uses `FOR UPDATE` on the round_participant row to
   * serialize concurrent callers. If the `attemptId` is already set
   * (a concurrent `startRoundAttemptTx` beat us), returns the existing
   * `attemptId` without creating a duplicate.
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
