/**
 * User Query Port
 *
 * Interface for querying basic user data from the User domain.
 * Profile domain needs username, email (private), and creation date.
 */

export const USER_QUERY_PORT = Symbol('USER_QUERY_PORT');

export interface UserBasicInfo {
  userId: string;
  username: string;
  createdAt: string;
}

export interface UserQueryPort {
  /**
   * Get basic user info for profile display.
   */
  getBasicInfo(userId: string): Promise<UserBasicInfo | null>;

  /**
   * Check if user exists.
   */
  exists(userId: string): Promise<boolean>;
}
