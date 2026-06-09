/**
 * User Search Port
 *
 * Interface for user search functionality.
 * Allows Social domain to search users without depending on User module implementation.
 */

import type { UserSearchResult } from '../types/social.types';

export interface UserSearchPort {
  /**
   * Search users by username or display name.
   * @param query - Search query string
   * @param limit - Maximum number of results
   * @param excludeUserId - Optional user ID to exclude from results
   */
  searchUsers(query: string, limit: number, excludeUserId?: string): Promise<UserSearchResult[]>;

  /**
   * Search username suggestions by prefix.
   * @param query - Prefix query string
   * @param limit - Maximum number of suggestions
   */
  searchUsernameSuggestions(query: string, limit: number): Promise<string[]>;
}

export const USER_SEARCH_PORT = Symbol('USER_SEARCH_PORT');
