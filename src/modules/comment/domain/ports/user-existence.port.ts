/**
 * UserExistencePort
 *
 * Abstracts user existence checks so the Comment domain does not depend
 * on the User module's internal repository. Similar to QuizExistencePort.
 */

export interface UserPublicInfo {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export const USER_EXISTENCE_PORT = Symbol('USER_EXISTENCE_PORT');

export interface UserExistencePort {
  /**
   * Returns true if a user with the given ID exists.
   */
  exists(userId: string): Promise<boolean>;

  /**
   * Returns public info for users matching the given usernames.
   * Unknown usernames are silently ignored.
   */
  findByUsernames(usernames: string[]): Promise<UserPublicInfo[]>;
}
