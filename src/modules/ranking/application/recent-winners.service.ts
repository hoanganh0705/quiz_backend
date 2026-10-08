import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { userActivityEvents, userProfiles, users } from '@/core/database/schema';
import type {
  RecentWinnersResponseDto,
  WinnerSummaryDto,
} from '../dto/response/recent-winners-response.dto';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const RECENT_WINNERS_CACHE_TTL_MS = 60_000;

@Injectable()
export class RecentWinnersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
  ) {}

  async getRecentWinners(limit = 10): Promise<RecentWinnersResponseDto> {
    const cacheKey = `leaderboard:recent-winners:${limit}`;
    return this.cache.getOrSetWithStampedeProtection<RecentWinnersResponseDto>(
      cacheKey,
      RECENT_WINNERS_CACHE_TTL_MS,
      async () => this.fetchRecentWinners(limit),
      5_000,
      50,
      10,
    );
  }

  private async fetchRecentWinners(limit: number): Promise<RecentWinnersResponseDto> {
    const rows = await this.db
      .select({
        eventId: userActivityEvents.eventId,
        userId: userActivityEvents.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        occurredAt: userActivityEvents.occurredAt,
        metadata: userActivityEvents.metadata,
      })
      .from(userActivityEvents)
      .innerJoin(users, eq(users.userId, userActivityEvents.userId))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.userId))
      .where(
        and(
          eq(userActivityEvents.eventType, 'tournament_won'),
          eq(userActivityEvents.visibility, 'public'),
        ),
      )
      .orderBy(desc(userActivityEvents.occurredAt))
      .limit(limit);

    const winners: WinnerSummaryDto[] = rows.map((row) => {
      const meta = (row.metadata ?? {}) as { tournamentTitle?: string; prizeXps?: number };
      return {
        userId: row.userId,
        username: row.username,
        displayName: row.displayName ?? null,
        avatarUrl: row.avatarUrl ?? null,
        quizTitle: meta.tournamentTitle ?? 'Tournament',
        amountWon: typeof meta.prizeXps === 'number' ? (meta.prizeXps / 100).toFixed(2) : '0.00',
        timeAgo: timeAgo(row.occurredAt),
        wonAt: row.occurredAt,
      };
    });

    return {
      winners,
      lastUpdated: new Date().toISOString(),
    };
  }
}

function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'moments ago';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'moments ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
