import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  notifications,
  notificationPreferences,
  notificationType,
  notificationChannel,
} from '@/modules/notification/infrastructure/notification.schema';
import { NOTIFICATION_REPOSITORY_PORT, type NotificationRepositoryPort } from '../ports/notification-ports';
import type {
  Notification,
  NotificationPreferencesRow,
  CreateNotificationParams,
  NotificationListParams,
} from '../types/notification.types';
import { eq, and, desc, sql, lt, isNull, or } from 'drizzle-orm';

@Injectable()
export class NotificationRepository implements NotificationRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: CreateNotificationParams): Promise<Notification> {
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

  async findById(id: string): Promise<Notification | null> {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.notificationId, id), isNull(notifications.deletedAt)));

    return notification ? this.mapToNotification(notification) : null;
  }

  async findByUser(params: NotificationListParams & { userId: string }): Promise<Notification[]> {
    const conditions = [eq(notifications.userId, params.userId), isNull(notifications.deletedAt)];

    if (params.cursor) {
      conditions.push(
        or(
          sql`${notifications.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(notifications.createdAt, params.cursor.createdAt),
            sql`${notifications.notificationId} < ${params.cursor.notificationId}`,
          ),
        ) as any,
      );
    }

    if (params.unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const query = this.db
      .select()
      .from(notifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(notifications.createdAt))
      .limit(params.limit + 1);

    const results = await query;
    return results.map(this.mapToNotification);
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

  async delete(notificationId: string, userId: string): Promise<void> {
    // Hard delete (for admin use cases)
    await this.db
      .delete(notifications)
      .where(
        and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.userId, userId),
        ),
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

  // Preferences methods
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
      // Update
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
      // Insert with defaults
      const defaults = {
        inAppEnabled: prefs.inAppEnabled ?? true,
        emailEnabled: prefs.emailEnabled ?? true,
        pushEnabled: prefs.pushEnabled ?? true,
        achievementEnabled: prefs.achievementEnabled ?? true,
        tournamentEnabled: prefs.tournamentEnabled ?? true,
        rankEnabled: prefs.rankEnabled ?? true,
        friendEnabled: prefs.friendEnabled ?? true,
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

  private mapToNotification(row: typeof notifications.$inferSelect): Notification {
    return {
      notificationId: row.notificationId,
      userId: row.userId,
      type: row.type as Notification['type'],
      title: row.title,
      message: row.message,
      metadata: row.metadata as Record<string, unknown>,
      channel: row.channel as Notification['channel'],
      isRead: row.isRead,
      readAt: row.readAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
    };
  }

  private mapToPreferences(row: typeof notificationPreferences.$inferSelect): NotificationPreferencesRow {
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
    const {
      preferencesId,
      userId,
      createdAt,
      updatedAt,
      ...rest
    } = prefs as any;
    return rest;
  }
}
