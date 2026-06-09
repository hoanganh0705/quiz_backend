import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { notifications, notificationPreferences } from '@/core/database/schema';

import { eq, and, desc, sql, isNull, or, inArray } from 'drizzle-orm';
import { NotificationRepositoryPort } from '../../domain/ports';
import type { Notification as DomainNotification } from '../../domain/types';
import type { NotificationAnalytics } from '../../domain/types';
import {
  CreateNotificationParams,
  NotificationListParams,
  NotificationPreferencesRow,
} from '../../domain/types';

const BADGE_TYPES = ['achievement_earned', 'badge_unlocked', 'badge_earned', 'streak_milestone'];
const DISCUSSION_TYPES = ['discussion_reply', 'discussion_mention', 'discussion_solved'];
const SOCIAL_TYPES = ['friend_request', 'friend_accepted', 'followed'];
const RANKING_TYPES = [
  'rank_achievement',
  'rank_improvement',
  'period_winner',
  'rank_improved',
  'rank_milestone',
];
const TOURNAMENT_TYPES = [
  'tournament_invite',
  'tournament_starting',
  'tournament_completed',
  'tournament_won',
  'tournament_started',
  'tournament_reminder',
];

@Injectable()
export class NotificationRepository implements NotificationRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: CreateNotificationParams): Promise<DomainNotification> {
    const [notification] = await this.db
      .insert(notifications)
      .values({
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata ?? {},
        channel: params.channel ?? 'in_app',
        expiresAt: params.expiresAt ?? null,
      })
      .returning();

    return this.mapToNotification(notification);
  }

  async findById(id: string): Promise<DomainNotification | null> {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.notificationId, id), isNull(notifications.deletedAt)));

    return notification ? this.mapToNotification(notification) : null;
  }

  async findByUser(
    params: NotificationListParams & { userId: string },
  ): Promise<DomainNotification[]> {
    const conditions = [eq(notifications.userId, params.userId)];

    if (!params.includeArchived) {
      conditions.push(isNull(notifications.deletedAt));
    }

    if (params.cursor) {
      conditions.push(
        or(
          sql`${notifications.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(notifications.createdAt, params.cursor.createdAt),
            sql`${notifications.notificationId} < ${params.cursor.notificationId}`,
          ),
        )!,
      );
    }

    if (params.unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    if (params.type) {
      conditions.push(eq(notifications.type, params.type));
    }

    const query = this.db
      .select()
      .from(notifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(notifications.createdAt), desc(notifications.notificationId))
      .limit(params.limit + 1);

    const results = await query;
    return results.map((row) => this.mapToNotification(row));
  }

  async countUnread(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
          isNull(notifications.deletedAt),
        ),
      );

    return Number(result?.count ?? 0);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date().toISOString() })
      .where(
        and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.userId, userId),
          isNull(notifications.deletedAt),
        ),
      );
  }

  async markAsUnread(notificationId: string, userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ isRead: false, readAt: null })
      .where(
        and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.userId, userId),
          isNull(notifications.deletedAt),
        ),
      );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date().toISOString() })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
          isNull(notifications.deletedAt),
        ),
      );
  }

  async deleteReadNotifications(userId: string): Promise<number> {
    const deletedAt = new Date().toISOString();
    const result = await this.db
      .update(notifications)
      .set({ deletedAt })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, true),
          isNull(notifications.deletedAt),
        ),
      );

    return Number(result.rowCount ?? 0);
  }

  async delete(notificationId: string, userId: string): Promise<void> {
    await this.db
      .delete(notifications)
      .where(
        and(eq(notifications.notificationId, notificationId), eq(notifications.userId, userId)),
      );
  }

  async softDelete(notificationId: string, userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ deletedAt: new Date().toISOString() })
      .where(
        and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.userId, userId),
          isNull(notifications.deletedAt),
        ),
      );
  }

  async deleteExpired(): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .delete(notifications)
      .where(
        and(
          isNull(notifications.deletedAt),
          sql`${notifications.expiresAt} IS NOT NULL AND ${notifications.expiresAt} < ${now}`,
        ),
      );
  }

  async getAnalytics(userId: string): Promise<NotificationAnalytics> {
    const [result] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        unread: sql<number>`count(*) filter (where ${notifications.isRead} = false)::int`,
        badge: sql<number>`count(*) filter (where ${inArray(notifications.type, BADGE_TYPES as never)})::int`,
        discussion: sql<number>`count(*) filter (where ${inArray(notifications.type, DISCUSSION_TYPES as never)})::int`,
        social: sql<number>`count(*) filter (where ${inArray(notifications.type, SOCIAL_TYPES as never)})::int`,
        ranking: sql<number>`count(*) filter (where ${inArray(notifications.type, RANKING_TYPES as never)})::int`,
        tournament: sql<number>`count(*) filter (where ${inArray(notifications.type, TOURNAMENT_TYPES as never)})::int`,
      })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.deletedAt)));

    return {
      total: Number(result?.total ?? 0),
      unread: Number(result?.unread ?? 0),
      badge: Number(result?.badge ?? 0),
      discussion: Number(result?.discussion ?? 0),
      social: Number(result?.social ?? 0),
      ranking: Number(result?.ranking ?? 0),
      tournament: Number(result?.tournament ?? 0),
    };
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesRow | null> {
    const [prefs] = await this.db
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
      const [updated] = await this.db
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
        discussionEnabled: prefs.discussionEnabled ?? true,
        summaryEnabled: prefs.summaryEnabled ?? true,
        marketingEnabled: prefs.marketingEnabled ?? false,
        rankImprovementThreshold: prefs.rankImprovementThreshold ?? 5,
        quietHoursStart: prefs.quietHoursStart ?? null,
        quietHoursEnd: prefs.quietHoursEnd ?? null,
      };

      const [created] = await this.db
        .insert(notificationPreferences)
        .values({
          userId,
          ...defaults,
        })
        .returning();

      return this.mapToPreferences(created);
    }
  }

  private mapToNotification(row: typeof notifications.$inferSelect): DomainNotification {
    return {
      notificationId: row.notificationId,
      userId: row.userId,
      type: row.type,
      title: row.title,
      message: row.message,
      metadata: row.metadata as Record<string, unknown>,
      channel: row.channel,
      isRead: row.isRead,
      readAt: row.readAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
    };
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
      discussionEnabled: row.discussionEnabled,
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
