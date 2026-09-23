import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { userRanking, users } from '@/core/database/schema';
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '@/common/database/soft-delete.helper';
import type { UserRankingRow } from '../../../domain/ports/user-repository.port';

export const USER_RANKING_COLUMNS = {
  userId: userRanking.userId,
  globalRank: userRanking.allTimeRank,
  totalScore: userRanking.allTimeXp,
  updatedAt: userRanking.updatedAt,
};

@Injectable()
export class UserRankingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getUserRanking(userId: string): Promise<UserRankingRow | null> {
    const [ranking] = await this.db
      .select(USER_RANKING_COLUMNS)
      .from(userRanking)
      .innerJoin(users, eq(userRanking.userId, users.userId))
      .where(and(eq(userRanking.userId, userId), notDeleted(users.deletedAt)))
      .limit(1);

    return ranking ?? null;
  }

  async createUserRanking(userId: string): Promise<UserRankingRow> {
    const [result] = await this.db
      .insert(userRanking)
      .values({ userId })
      .returning(USER_RANKING_COLUMNS);

    return result as UserRankingRow;
  }
}
