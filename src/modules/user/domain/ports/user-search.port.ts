export interface UserSearchResult {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface UserSearchPort {
  searchUsers(query: string, limit: number, excludeUserId?: string): Promise<UserSearchResult[]>;
  searchUsernameSuggestions(query: string, limit: number): Promise<string[]>;
}

export const USER_SEARCH_PORT = Symbol('USER_SEARCH_PORT');
