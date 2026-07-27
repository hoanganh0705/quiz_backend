import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Social-module namespace marker for social-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, attempt, user,
 * category, tag, tournament, review, bookmark, and instance modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. Audit:
 * `grep -rn 'new SocialError' src/` returns no matches.
 */
export abstract class SocialError extends BaseDomainException {}

/**
 * Thrown when a friend request cannot be found by ID. 404 Not Found.
 *
 * Wire-shape improvement: the prior per-module filter dropped the
 * request ID and rewrote every `FriendRequestNotFoundError.message`
 * to a hardcoded generic `'Friend request not found'`. The global
 * filter now preserves `exception.message` (default format:
 * `'Friend request not found: <id>'`, with the ID interpolated
 * from the constructor argument).
 */
export class FriendRequestNotFoundError extends SocialError {
  readonly code = 'SOCIAL_FRIEND_REQUEST_NOT_FOUND';
  constructor(id: string) {
    super(`Friend request not found: ${id}`);
  }
}

/**
 * Thrown when the authenticated user lacks permission to respond to
 * a friend request. 403 Forbidden.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `FriendRequestForbiddenError.message` to a hardcoded generic
 * `'You do not have permission to perform this action'`. The global
 * filter now preserves `exception.message` (default:
 * `'You do not have permission to respond to this friend request'`).
 */
export class FriendRequestForbiddenError extends SocialError {
  readonly code = 'SOCIAL_FRIEND_REQUEST_FORBIDDEN';
  constructor() {
    super('You do not have permission to respond to this friend request');
  }
}

/**
 * Raised when a user attempts to read another user's friend list
 * without being allowed to do so. Allow-list: self, or users who
 * are mutual friends with the target (and neither side has blocked
 * the other). 403 Forbidden.
 *
 * Wire-shape improvement: the prior per-module filter preserved
 * the thrown message verbatim; behavior is unchanged.
 */
export class FriendListForbiddenError extends SocialError {
  readonly code = 'SOCIAL_FRIEND_LIST_FORBIDDEN';
  constructor() {
    super('You do not have permission to view this user\u2019s friend list');
  }
}

/**
 * Thrown when a user attempts to send a friend request to
 * themselves. 400 Bad Request.
 *
 * Wire-shape improvement: the prior per-module filter preserved
 * the thrown message verbatim; behavior is unchanged.
 */
export class SelfFriendRequestError extends SocialError {
  readonly code = 'SOCIAL_SELF_FRIEND_REQUEST';
  constructor() {
    super('You cannot send a friend request to yourself');
  }
}

/**
 * Thrown when the user attempts to send a friend request to a user
 * they are already friends with. 409 Conflict.
 *
 * Wire-shape improvement: the prior per-module filter preserved
 * the thrown message verbatim; behavior is unchanged.
 */
export class AlreadyFriendsError extends SocialError {
  readonly code = 'SOCIAL_ALREADY_FRIENDS';
  constructor() {
    super('You are already friends with this user');
  }
}

/**
 * Thrown when the actor has blocked the target user and the action
 * is forbidden as a result. 403 Forbidden.
 *
 * Wire-shape improvement: the prior per-module filter preserved
 * the thrown message verbatim; behavior is unchanged.
 */
export class BlockedUserError extends SocialError {
  readonly code = 'SOCIAL_BLOCKED_USER';
  constructor() {
    super('Cannot perform this action on a blocked user');
  }
}

/**
 * Thrown when the target user has blocked the actor. 403 Forbidden.
 *
 * Wire-shape improvement: the prior per-module filter preserved
 * the thrown message verbatim; behavior is unchanged.
 */
export class UserBlockedError extends SocialError {
  readonly code = 'SOCIAL_USER_BLOCKED';
  constructor() {
    super('This user has blocked you');
  }
}

/**
 * Thrown when an attempt is made to send a friend request while one
 * is already pending between the two users. 409 Conflict.
 *
 * Wire-shape improvement: the prior per-module filter preserved
 * the thrown message verbatim; behavior is unchanged.
 */
export class PendingRequestExistsError extends SocialError {
  readonly code = 'SOCIAL_PENDING_REQUEST_EXISTS';
  constructor() {
    super('A friend request is already pending');
  }
}

/**
 * Thrown when `DELETE /social/friends/:userId` is called but no
 * accepted friendship exists between the caller and `:userId`.
 *
 * Business rationale (audit issue: silent-success DELETE): the
 * endpoint means "delete an existing friendship", not "ensure no
 * friendship exists". When the friendship is absent, the resource
 * the URL targets does not exist — the correct wire shape is 404,
 * not silent 204. The sibling `cancelFriendRequest` already throws
 * `FriendRequestNotFoundError` (404) for the same reason; this
 * class is the parallel shape for the accepted-friendship table.
 *
 * The endpoint's downstream side effects (cache invalidation,
 * `friend_removed` domain event, audit log) are conditional on the
 * existence check — see `SocialService.removeFriend`. Skipping the
 * throw here would let those side effects fire on no-op calls.
 */
export class FriendshipNotFoundError extends SocialError {
  readonly code = 'SOCIAL_FRIENDSHIP_NOT_FOUND';
  constructor(friendId: string) {
    super(`You are not friends with user ${friendId}`);
  }
}

/**
 * Thrown when `DELETE /social/block/:userId` is called but no
 * active block exists between the caller and `:userId`.
 *
 * Business rationale (audit issue: silent-success DELETE): the
 * endpoint means "unblock an existing block", not "ensure no block
 * exists". The audit-log side effect (`social.user.unblocked`
 * event) is the most user-visible consequence of the bug — every
 * silent-no-op call writes a false-positive audit entry that
 * pollutes forensic queries. After this class is thrown, the audit
 * write is conditional on the existence check.
 */
export class UserNotBlockedError extends SocialError {
  readonly code = 'SOCIAL_USER_NOT_BLOCKED';
  constructor(blockedId: string) {
    super(`You have not blocked user ${blockedId}`);
  }
}

/**
 * Thrown when `DELETE /social/follow/:userId` is called but no
 * active follow relationship exists between the caller and
 * `:userId`.
 *
 * Business rationale (audit issue: silent-success DELETE): the
 * endpoint means "unfollow an existing follow", not "ensure no
 * follow exists". The notification side effect
 * (`user_unfollowed` event consumed by the social notification
 * listener) is the most user-visible consequence — the target user
 * could be told "X unfollowed you" when X was never following them.
 */
export class FollowNotFoundError extends SocialError {
  readonly code = 'SOCIAL_FOLLOW_NOT_FOUND';
  constructor(followingId: string) {
    super(`You are not following user ${followingId}`);
  }
}
