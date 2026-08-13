import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { and, eq, ilike, isNull, ne, or } from 'drizzle-orm';
import { userProfiles, users } from '@/core/database/schema';
import type {
  UserSearchPort,
  UserSearchResult,
  UsernameSuggestion,
} from '../../domain/ports/user-search.port';

@Injectable()
export class UserSearchAdapter implements UserSearchPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async searchUsers(
    query: string,
    limit: number,
    excludeUserId?: string,
  ): Promise<UserSearchResult[]> {
    if (!query || query.trim().length < 1) {
      return [];
    }
    const searchPattern = `%${query}%`;

    const baseConditions = [
      isNull(users.deletedAt),
      or(ilike(users.username, searchPattern), ilike(userProfiles.displayName, searchPattern)),
    ];

    const allConditions = excludeUserId
      ? [...baseConditions, ne(users.userId, excludeUserId)]
      : baseConditions;

    const rows = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(...allConditions))
      .limit(limit);

    return rows as UserSearchResult[];
  }

  async searchUsernameSuggestions(query: string, limit: number): Promise<UsernameSuggestion[]> {
    if (!query || query.trim().length < 1) {
      return [];
    }

    const searchPattern = `${query}%`;

    const rows = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(isNull(users.deletedAt), ilike(users.username, searchPattern)))
      .limit(limit);

    return rows as UsernameSuggestion[];
  }
}
