export class SocialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SocialError';
  }
}

export class FriendRequestNotFoundError extends SocialError {
  constructor(id: string) {
    super(`Friend request not found: ${id}`);
    this.name = 'FriendRequestNotFoundError';
  }
}

export class FriendRequestForbiddenError extends SocialError {
  constructor() {
    super('You do not have permission to respond to this friend request');
    this.name = 'FriendRequestForbiddenError';
  }
}

/**
 * Raised when a user attempts to read another user's friend
 * list without being allowed to do so. Allow-list: self, or
 * users who are mutual friends with the target (and neither
 * side has blocked the other).
 */
export class FriendListForbiddenError extends SocialError {
  constructor() {
    super('You do not have permission to view this user’s friend list');
    this.name = 'FriendListForbiddenError';
  }
}

export class SelfFriendRequestError extends SocialError {
  constructor() {
    super('You cannot send a friend request to yourself');
    this.name = 'SelfFriendRequestError';
  }
}

export class AlreadyFriendsError extends SocialError {
  constructor() {
    super('You are already friends with this user');
    this.name = 'AlreadyFriendsError';
  }
}

export class BlockedUserError extends SocialError {
  constructor() {
    super('Cannot perform this action on a blocked user');
    this.name = 'BlockedUserError';
  }
}

export class UserBlockedError extends SocialError {
  constructor() {
    super('This user has blocked you');
    this.name = 'UserBlockedError';
  }
}

export class PendingRequestExistsError extends SocialError {
  constructor() {
    super('A friend request is already pending');
    this.name = 'PendingRequestExistsError';
  }
}
