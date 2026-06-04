/**
 * Port for storing and querying a user's password change history.
 *
 * Used by the domain to enforce password reuse policy: before accepting a new
 * password, the domain calls isPasswordReused() to check it against the last N
 * stored hashes. The implementation stores bcrypt hashes — comparison is done
 * via bcrypt.compare() inside the adapter.
 *
 * The adapter is responsible for:
 * - Storing bcrypt password hashes (NOT the plaintext passwords).
 * - Pruning entries beyond the configured history retention window.
 * - Enforcing the maximum history size per user.
 */
export interface PasswordHistoryPort {
  /**
   * Returns the most recent `count` password hashes for the given user,
   * ordered newest-first.
   */
  getRecentPasswordHashes(userId: string, count: number): Promise<string[]>;

  /**
   * Adds a new password hash to the user's history, then prunes any entries
   * beyond `maxHistorySize` (oldest first).
   *
   * @param userId - the user whose history to update
   * @param passwordHash - the bcrypt hash to store (not the plaintext)
   * @param nowIso - timestamp to use as createdAt
   * @param maxHistorySize - maximum number of entries to retain per user
   */
  addPasswordToHistory(
    userId: string,
    passwordHash: string,
    nowIso: string,
    maxHistorySize: number,
  ): Promise<void>;
}

export const PASSWORD_HISTORY_PORT = Symbol('PASSWORD_HISTORY_PORT');
