import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { userActivityEvents, userProfiles, users } from '@/core/database/schema';
import type {
  RecentWinnersResponseDto,
  WinnerSummaryDto,
} from '../dto/response/recent-winners-response.dto';

/**
 * Phase 3 (S-15): read service for the live-winners carousel.
 *
 * Reads the `user_activity_events` table for the
 * `tournament_won` rows, joined to the user record for the
 * public-facing summary. The `amountWon` value is read from
 * the `metadata.prizeXps` column when present, falling back to
 * a static formatter.
 */
@Injectable()
export class RecentWinnersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getRecentWinners(limit = 10): Promise<RecentWinnersResponseDto> {
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

/**
 * Tiny server-side time-ago renderer. Phase 3 keeps the wire
 * shape fixed at "N units ago" / "moments ago" — the frontend
 * always reads `timeAgo` verbatim.
 */
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
