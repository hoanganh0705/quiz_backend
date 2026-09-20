import {
  TournamentAuthorizationPolicy,
  type TournamentActor,
  type TournamentOwnershipTarget,
} from './tournament-authorization.policy';
import type { UserRole } from '@/common/authorization/permissions';

const admin: TournamentActor = { sub: 'admin-1', role: 'admin' as UserRole };
const moderator: TournamentActor = { sub: 'mod-1', role: 'moderator' as UserRole };
const user: TournamentActor = { sub: 'user-1', role: 'user' as UserRole };
const otherUser: TournamentActor = { sub: 'user-2', role: 'user' as UserRole };

const upcomingOwnedByUser: TournamentOwnershipTarget = {
  tournamentId: 't-1',
  ownerUserId: 'user-1',
  status: 'upcoming',
  deletedAt: null,
};

const registrationOwnedByUser: TournamentOwnershipTarget = {
  tournamentId: 't-1',
  ownerUserId: 'user-1',
  status: 'registration',
  deletedAt: null,
};

const ongoingOwnedByUser: TournamentOwnershipTarget = {
  tournamentId: 't-1',
  ownerUserId: 'user-1',
  status: 'ongoing',
  deletedAt: null,
};

const finished: TournamentOwnershipTarget = {
  tournamentId: 't-1',
  ownerUserId: 'user-1',
  status: 'finished',
  deletedAt: null,
};

const cancelled: TournamentOwnershipTarget = {
  tournamentId: 't-1',
  ownerUserId: 'user-1',
  status: 'cancelled',
  deletedAt: null,
};

const softDeleted: TournamentOwnershipTarget = {
  tournamentId: 't-1',
  ownerUserId: 'user-1',
  status: 'upcoming',
  deletedAt: '2026-01-01T00:00:00.000Z',
};

describe('TournamentAuthorizationPolicy', () => {
  describe('canEdit', () => {
    it('allows admin on any non-terminal, non-deleted tournament', () => {
      expect(TournamentAuthorizationPolicy.canEdit(admin, upcomingOwnedByUser)).toBe(true);
      expect(TournamentAuthorizationPolicy.canEdit(admin, ongoingOwnedByUser)).toBe(true);
    });

    it('allows owner to edit their own upcoming tournament', () => {
      expect(TournamentAuthorizationPolicy.canEdit(user, upcomingOwnedByUser)).toBe(true);
      expect(TournamentAuthorizationPolicy.canEdit(user, registrationOwnedByUser)).toBe(true);
    });

    it("blocks a different user from editing someone else's tournament", () => {
      expect(TournamentAuthorizationPolicy.canEdit(otherUser, upcomingOwnedByUser)).toBe(false);
    });

    it('blocks editing finished or cancelled tournaments', () => {
      expect(TournamentAuthorizationPolicy.canEdit(user, finished)).toBe(false);
      expect(TournamentAuthorizationPolicy.canEdit(user, cancelled)).toBe(false);
      expect(TournamentAuthorizationPolicy.canEdit(admin, finished)).toBe(false);
    });

    it('blocks editing soft-deleted tournaments', () => {
      expect(TournamentAuthorizationPolicy.canEdit(user, softDeleted)).toBe(false);
      expect(TournamentAuthorizationPolicy.canEdit(admin, softDeleted)).toBe(false);
    });
  });

  describe('canCancel', () => {
    it('allows admin to cancel an upcoming tournament', () => {
      expect(TournamentAuthorizationPolicy.canCancel(admin, upcomingOwnedByUser)).toBe(true);
    });

    it('allows admin to cancel a registration tournament', () => {
      expect(TournamentAuthorizationPolicy.canCancel(admin, registrationOwnedByUser)).toBe(true);
    });

    it('blocks cancelling an ongoing tournament', () => {
      expect(TournamentAuthorizationPolicy.canCancel(admin, ongoingOwnedByUser)).toBe(false);
    });

    it('blocks cancelling finished or cancelled tournaments', () => {
      expect(TournamentAuthorizationPolicy.canCancel(admin, finished)).toBe(false);
      expect(TournamentAuthorizationPolicy.canCancel(admin, cancelled)).toBe(false);
    });

    it('blocks a regular user even if they are the owner', () => {
      expect(TournamentAuthorizationPolicy.canCancel(user, upcomingOwnedByUser)).toBe(false);
    });

    it('blocks cancelling a soft-deleted tournament', () => {
      expect(TournamentAuthorizationPolicy.canCancel(admin, softDeleted)).toBe(false);
    });
  });

  describe('canSoftDelete', () => {
    it('allows admin to soft-delete a non-terminal tournament', () => {
      expect(TournamentAuthorizationPolicy.canSoftDelete(admin, upcomingOwnedByUser)).toBe(true);
      expect(TournamentAuthorizationPolicy.canSoftDelete(admin, ongoingOwnedByUser)).toBe(true);
    });

    it('allows owner to soft-delete their own tournament', () => {
      expect(TournamentAuthorizationPolicy.canSoftDelete(user, upcomingOwnedByUser)).toBe(true);
    });

    it('blocks a non-owner user from soft-deleting', () => {
      expect(TournamentAuthorizationPolicy.canSoftDelete(otherUser, upcomingOwnedByUser)).toBe(
        false,
      );
    });

    it('blocks soft-deleting finished or cancelled tournaments', () => {
      expect(TournamentAuthorizationPolicy.canSoftDelete(user, finished)).toBe(false);
      expect(TournamentAuthorizationPolicy.canSoftDelete(user, cancelled)).toBe(false);
    });

    it('blocks soft-deleting an already soft-deleted tournament', () => {
      expect(TournamentAuthorizationPolicy.canSoftDelete(user, softDeleted)).toBe(false);
      expect(TournamentAuthorizationPolicy.canSoftDelete(admin, softDeleted)).toBe(false);
    });
  });

  it('moderator role cannot edit tournaments unless granted EDIT_ANY', () => {
    expect(TournamentAuthorizationPolicy.canEdit(moderator, upcomingOwnedByUser)).toBe(false);
  });
});
