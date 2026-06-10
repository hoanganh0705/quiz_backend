import { UserDomainError } from './user-domain.errors';

export class UserProfilePrivateError extends UserDomainError {
  readonly code = 'USER_PROFILE_PRIVATE';

  constructor(targetUserId: string) {
    super(`Profile of user ${targetUserId} is not public`);
    this.name = 'UserProfilePrivateError';
  }
}
