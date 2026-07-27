import { Inject, Injectable, Optional } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { eq } from 'drizzle-orm';
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

  async upsertPreferences(
    userId: string,
    prefs: Partial<NotificationPreferencesRow>,
  ): Promise<NotificationPreferencesRow> {
    const existing = await this.getPreferences(userId);

    if (existing) {
      const [updated] = await this.getDb()
        .update(notificationPreferences)
        .set({
          ...this.stripPreferenceFields(prefs),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(notificationPreferences.userId, userId))
        .returning();

      return this.mapToPreferences(updated);
    } else {
      const defaults = {
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

      const [created] = await this.getDb()
        .insert(notificationPreferences)
        .values({
          userId,
          ...defaults,
        })
        .returning();

      return this.mapToPreferences(created);
    }
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

  private stripPreferenceFields(
    prefs: Partial<NotificationPreferencesRow>,
  ): Partial<typeof notificationPreferences.$inferInsert> {
    const { preferencesId, userId, createdAt, updatedAt, ...rest } = prefs as Required<
      Pick<NotificationPreferencesRow, 'preferencesId' | 'userId' | 'createdAt' | 'updatedAt'>
    > &
      Partial<NotificationPreferencesRow>;
    void preferencesId;
    void userId;
    void createdAt;
    void updatedAt;
    return rest;
  }
}
