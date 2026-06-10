export class UserProfilePrivateError extends Error {
  readonly code = 'USER_PROFILE_PRIVATE';

  constructor(targetUserId: string) {
    super(`Profile of user ${targetUserId} is not public`);
    this.name = 'UserProfilePrivateError';
  }
}
