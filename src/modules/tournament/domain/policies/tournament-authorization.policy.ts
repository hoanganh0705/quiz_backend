import { hasPermission, Permission, type UserRole } from '@/common/authorization/permissions';

export type TournamentActor = {
  sub: string;
  role: UserRole;
};

/**
 * Subset of `TournamentRow` that the policy needs to make an edit /
 * cancel decision. Keeping the policy's input structural means the
 * repository can return more columns than the policy consumes without
 * driving the policy's type through the entire read path.
 *
 * The `ownerUserId` is the `tournaments.owner_user_id` column added by
 * Phase 1 / Issue #2 — the canonical ownership anchor.
 */
export type TournamentOwnershipTarget = {
  tournamentId: string;
  ownerUserId: string;
  status: 'upcoming' | 'registration' | 'ongoing' | 'finished' | 'cancelled';
  deletedAt: string | null;
};

/**
 * Defense-in-depth authorization for tournament mutations.
 *
 * NOTE: coarse-grained authorization is enforced at the controller
 * layer by `PermissionsGuard` reading the `TOURNAMENT_EDIT_OWN`,
 * `TOURNAMENT_EDIT_ANY`, and `TOURNAMENT_CANCEL` permissions on
 * `@Permissions(...)`. These checks stay behind the guard so direct
 * callers (background jobs, future internal use) cannot bypass them,
 * and so the same rules apply to in-process calls from the scheduler
 * or the eventual tournament-moderation job.
 *
 * Mirrors the `ReviewAuthorizationPolicy` shape that this module's
 * neighbors already follow.
 */
export const TournamentAuthorizationPolicy = {
  /**
   * Phase 1 / Issue #1 — decide whether `actor` may edit
   * (update/soft-delete) the given tournament.
   *
   *   1. The tournament must not be soft-deleted — soft-deleted
   *      tournaments are off-limits to every role, including the
   *      owner. If a deleted tournament must be undeleted that is a
   *      future audit item (Issue #10 Phase 4) and lives behind a
   *      dedicated endpoint.
   *
   *   2. The actor either:
   *
   *        a. Is the tournament's `owner_user_id`, **and**
   *           holds `TOURNAMENT_EDIT_OWN`. The permission is
   *           included so the policy is robust against a future
   *           audit item that wants to revoke the OWN permission
   *           globally (e.g. when Phase 2 introduces an "immutable
   *           past tournament" rule) without touching this code.
   *
   *        b. Holds `TOURNAMENT_EDIT_ANY` (admin-only in
   *           Phase 1).
   *
   *      Note: the role of the actor does NOT bypass the
   *      ownership check — this is the canonical pattern from
   *      `ReviewAuthorizationPolicy.canModify` and
   *      `canViewAnalytics`.
   *
   * Returns `false` (rather than throwing) so callers can decide
   * whether to surface a 403 or a more specific 409 (state-conflict
   * for soft-deleted, etc.).
   */
  canEdit(actor: TournamentActor, target: TournamentOwnershipTarget): boolean {
    if (target.deletedAt !== null) return false;
    if (target.status === 'finished' || target.status === 'cancelled') return false;
    if (hasPermission(actor.role, Permission.TOURNAMENT_EDIT_ANY)) return true;
    if (
      target.ownerUserId === actor.sub &&
      hasPermission(actor.role, Permission.TOURNAMENT_EDIT_OWN)
    ) {
      return true;
    }
    return false;
  },

  /**
   * Phase 1 / Issue #1 — decide whether `actor` may cancel
   * (transition to `cancelled`) the given tournament.
   *
   * Cancellation is stricter than edit:
   *
   *   * Soft-deleted: never — the row is already gone.
   *   * `finished` or already `cancelled`: 409 Conflict — these are
   *     terminal states. Cancel from a finished tournament would be
   *     meaningless (no active participants) and would corrupt audit
   *     logs (the `finished` state carries final ranks).
   *   * `upcoming` or `registration`: OK.
   *   * `ongoing`: today the audit (Issue #10) bans cancelling an
   *     active tournament — participants have already started round
   *     attempts, and the `finished` transition is the canonical
   *     termination path. A future audit item may relax this and
   *     emit a `TournamentCancelledEvent`.
   *
   * The `TOURNAMENT_CANCEL` permission is admin-only, so the
   * role check here is mostly a guard against future role
   * changes that grant the permission to non-admins.
   */
  canCancel(actor: TournamentActor, target: TournamentOwnershipTarget): boolean {
    if (target.deletedAt !== null) return false;
    if (
      target.status === 'finished' ||
      target.status === 'cancelled' ||
      target.status === 'ongoing'
    ) {
      return false;
    }
    return hasPermission(actor.role, Permission.TOURNAMENT_CANCEL);
  },

  /**
   * Phase 1 / Issue #1 — decide whether `actor` may soft-delete
   * (transition via `deleted_at`) the given tournament.
   *
   * Mirrors `canEdit` — the same ownership / `TOURNAMENT_EDIT_*`
   * permission split — but adds one stricter rule: an admin cannot
   * soft-delete a tournament whose `start_at` has already passed.
   * Once participants have started round attempts a hard delete is
   * an audit-trail concern; soft delete is acceptable only for
   * future tournaments. This rule is enforced by the service layer
   * (it has the timestamp) rather than the policy (which only sees
   * the row fields).
   */
  canSoftDelete(actor: TournamentActor, target: TournamentOwnershipTarget): boolean {
    if (target.deletedAt !== null) return false;
    if (target.status === 'finished' || target.status === 'cancelled') return false;
    if (hasPermission(actor.role, Permission.TOURNAMENT_EDIT_ANY)) return true;
    if (
      target.ownerUserId === actor.sub &&
      hasPermission(actor.role, Permission.TOURNAMENT_EDIT_OWN)
    ) {
      return true;
    }
    return false;
  },
} as const;
