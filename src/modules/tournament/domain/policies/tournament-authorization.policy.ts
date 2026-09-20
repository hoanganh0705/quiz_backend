import { hasPermission, Permission, type UserRole } from '@/common/authorization/permissions';

export type TournamentActor = {
  sub: string;
  role: UserRole;
};

export type TournamentOwnershipTarget = {
  tournamentId: string;
  ownerUserId: string;
  status: 'upcoming' | 'registration' | 'ongoing' | 'finished' | 'cancelled';
  deletedAt: string | null;
};

export const TournamentAuthorizationPolicy = {
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
