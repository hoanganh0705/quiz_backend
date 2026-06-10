/**
 * User Search Port
 *
 * Interface for user search functionality.
 * Allows Social domain to search users without depending on User module implementation.
 * Re-exports the port and type from UserModule to avoid duplication.
 */

// Re-export port and symbol from UserModule (the producer)
export {
  type UserSearchPort,
  type UserSearchResult,
  USER_SEARCH_PORT,
} from '@/modules/user/domain/ports/user-search.port';

// Use the UserModule's UserSearchResult as the base type
import type { UserSearchResult } from '@/modules/user/domain/ports/user-search.port';

/**
 * Extend UserSearchResult with social relationship metadata.
 * Lives in SocialModule because it only makes sense in a social context.
 */
export interface SearchableUser extends UserSearchResult {
  isFriend: boolean;
  hasPendingRequest: boolean;
  isBlocked: boolean;
}
