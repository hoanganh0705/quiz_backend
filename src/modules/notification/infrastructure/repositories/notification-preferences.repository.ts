import { Inject, Injectable, Optional } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { eq, inArray, sql } from 'drizzle-orm';
import { notificationPreferences } from '@/core/database/schema';
import {
  TransactionalContext,
  TRANSACTIONAL_CONTEXT,
} from '@/common/interceptors/transactional-context';
import { NotificationPreferencesRepositoryPort } from '../../domain/ports';
import type { NotificationPreferencesRow } from '../../domain/types';

@Injectable()
export class NotificationPreferencesRepository implements NotificationPreferencesRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional()
    @Inject(TRANSACTIONAL_CONTEXT)
    private readonly transactionalContext?: TransactionalContext,
  ) {}

  private getDb(): DrizzleDB {
    const tx = this.transactionalContext?.getDbClient() as DrizzleDB | null;
    return tx ?? this.db;
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesRow | null> {
    const [prefs] = await this.getDb()
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    return prefs ? this.mapToPreferences(prefs) : null;
  }

  async getManyPreferences(userIds: string[]): Promise<Map<string, NotificationPreferencesRow>> {
    const result = new Map<string, NotificationPreferencesRow>();
    if (userIds.length === 0) {
      return result;
    }

    const uniqueUserIds = Array.from(new Set(userIds));
    const rows = await this.getDb()
      .select()
      .from(notificationPreferences)
      .where(inArray(notificationPreferences.userId, uniqueUserIds));

    for (const row of rows) {
      result.set(row.userId, this.mapToPreferences(row));
    }
    return result;
  }

  async upsertPreferences(
    userId: string,
    prefs: Partial<NotificationPreferencesRow>,
  ): Promise<NotificationPreferencesRow> {
    const nowIso = new Date().toISOString();
    const insertValues = {
      userId,
      inAppEnabled: prefs.inAppEnabled ?? true,
      emailEnabled: prefs.emailEnabled ?? true,
      pushEnabled: prefs.pushEnabled ?? true,
      achievementEnabled: prefs.achievementEnabled ?? true,
      tournamentEnabled: prefs.tournamentEnabled ?? true,
      rankEnabled: prefs.rankEnabled ?? true,
      friendEnabled: prefs.friendEnabled ?? true,
      commentEnabled: prefs.commentEnabled ?? true,
      summaryEnabled: prefs.summaryEnabled ?? true,
      marketingEnabled: prefs.marketingEnabled ?? false,
      rankImprovementThreshold: prefs.rankImprovementThreshold ?? 5,
      quietHoursStart: prefs.quietHoursStart ?? null,
      quietHoursEnd: prefs.quietHoursEnd ?? null,
    };

    const updateSet = {
      inAppEnabled: prefs.inAppEnabled ?? sql`${notificationPreferences.inAppEnabled}`,
      emailEnabled: prefs.emailEnabled ?? sql`${notificationPreferences.emailEnabled}`,
      pushEnabled: prefs.pushEnabled ?? sql`${notificationPreferences.pushEnabled}`,
      achievementEnabled:
        prefs.achievementEnabled ?? sql`${notificationPreferences.achievementEnabled}`,
      tournamentEnabled:
        prefs.tournamentEnabled ?? sql`${notificationPreferences.tournamentEnabled}`,
      rankEnabled: prefs.rankEnabled ?? sql`${notificationPreferences.rankEnabled}`,
      friendEnabled: prefs.friendEnabled ?? sql`${notificationPreferences.friendEnabled}`,
      commentEnabled: prefs.commentEnabled ?? sql`${notificationPreferences.commentEnabled}`,
      summaryEnabled: prefs.summaryEnabled ?? sql`${notificationPreferences.summaryEnabled}`,
      marketingEnabled: prefs.marketingEnabled ?? sql`${notificationPreferences.marketingEnabled}`,
      rankImprovementThreshold:
        prefs.rankImprovementThreshold ?? sql`${notificationPreferences.rankImprovementThreshold}`,
      quietHoursStart: prefs.quietHoursStart ?? sql`${notificationPreferences.quietHoursStart}`,
      quietHoursEnd: prefs.quietHoursEnd ?? sql`${notificationPreferences.quietHoursEnd}`,
      updatedAt: nowIso,
    };

    const [row] = await this.getDb()
      .insert(notificationPreferences)
      .values(insertValues)
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: updateSet,
      })
      .returning();

    return this.mapToPreferences(row);
  }

  private mapToPreferences(
    row: typeof notificationPreferences.$inferSelect,
  ): NotificationPreferencesRow {
    return {
      preferencesId: row.preferencesId,
      userId: row.userId,
      inAppEnabled: row.inAppEnabled,
      emailEnabled: row.emailEnabled,
      pushEnabled: row.pushEnabled,
      achievementEnabled: row.achievementEnabled,
      tournamentEnabled: row.tournamentEnabled,
      rankEnabled: row.rankEnabled,
      friendEnabled: row.friendEnabled,
      commentEnabled: row.commentEnabled,
      summaryEnabled: row.summaryEnabled,
      marketingEnabled: row.marketingEnabled,
      rankImprovementThreshold: row.rankImprovementThreshold,
      quietHoursStart: row.quietHoursStart,
      quietHoursEnd: row.quietHoursEnd,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }
}
