import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { notifications, notificationPreferences } from '@/modules/notification/infrastructure/notification.schema';
import { NOTIFICATION_REPOSITORY_PORT, type NotificationRepositoryPort } from '../ports/notification-ports';
import type { Notification, CreateNotificationParams, NotificationListParams } from '../types/notification.types';
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

    return notification as Notification;
  }

  async findById(id: string): Promise<Notification | null> {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.notificationId, id));

    return (notification as Notification) ?? null;
  }

  async findByUser(params: NotificationListParams): Promise<Notification[]> {
    const conditions = [];

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

    return query as Promise<Notification[]>;
  }

  async countUnread(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

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
        ),
      );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date().toISOString() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async delete(notificationId: string, userId: string): Promise<void> {
    await this.db
      .delete(notifications)
      .where(
        and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.userId, userId),
        ),
      );
  }

  async deleteExpired(): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .delete(notifications)
      .where(
        and(
          isNull(notifications.expiresAt),
          sql`${notifications.expiresAt} < ${now}`,
        ),
      );
  }
}
