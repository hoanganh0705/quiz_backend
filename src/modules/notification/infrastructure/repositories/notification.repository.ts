import { Inject, Injectable, Optional } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { notifications } from '@/core/database/schema';

import { eq, and, desc, sql, isNull, or, count, gt } from 'drizzle-orm';
import { NotificationRepositoryPort } from '../../domain/ports';
import type { Notification as DomainNotification } from '../../domain/types';
import { CreateNotificationParams, NotificationListParams } from '../../domain/types';
import {
  TransactionalContext,
  TRANSACTIONAL_CONTEXT,
} from '@/common/interceptors/transactional-context';

@Injectable()
export class NotificationRepository implements NotificationRepositoryPort {
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

  async create(params: CreateNotificationParams): Promise<DomainNotification> {
    const [notification] = await this.getDb()
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
    await this.getDb()
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
    await this.getDb()
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
    await this.getDb()
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
    const result = await this.getDb()
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
    await this.getDb()
      .delete(notifications)
      .where(
        and(eq(notifications.notificationId, notificationId), eq(notifications.userId, userId)),
      );
  }

  async softDelete(notificationId: string, userId: string): Promise<void> {
    await this.getDb()
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

  async deleteExpired(): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db
      .delete(notifications)
      .where(sql`${notifications.expiresAt} IS NOT NULL AND ${notifications.expiresAt} < ${now}`);

    return Number(result.rowCount ?? 0);
  }

  async getAnalytics(): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    last24h: number;
    last7d: number;
  }> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      [totalResult],
      [unreadResult],
      typeResults,
      channelResults,
      [last24hResult],
      [last7dResult],
    ] = await Promise.all([
      this.db.select({ value: count() }).from(notifications).where(isNull(notifications.deletedAt)),
      this.db
        .select({ value: count() })
        .from(notifications)
        .where(and(eq(notifications.isRead, false), isNull(notifications.deletedAt))),
      this.db
        .select({ type: notifications.type, value: count() })
        .from(notifications)
        .where(isNull(notifications.deletedAt))
        .groupBy(notifications.type),
      this.db
        .select({ channel: notifications.channel, value: count() })
        .from(notifications)
        .where(isNull(notifications.deletedAt))
        .groupBy(notifications.channel),
      this.db
        .select({ value: count() })
        .from(notifications)
        .where(and(gt(notifications.createdAt, dayAgo), isNull(notifications.deletedAt))),
      this.db
        .select({ value: count() })
        .from(notifications)
        .where(and(gt(notifications.createdAt, weekAgo), isNull(notifications.deletedAt))),
    ]);

    const byType: Record<string, number> = {};
    for (const row of typeResults) {
      byType[row.type] = Number(row.value);
    }

    const byChannel: Record<string, number> = {};
    for (const row of channelResults) {
      byChannel[row.channel] = Number(row.value);
    }

    return {
      total: Number(totalResult?.value ?? 0),
      unread: Number(unreadResult?.value ?? 0),
      byType,
      byChannel,
      last24h: Number(last24hResult?.value ?? 0),
      last7d: Number(last7dResult?.value ?? 0),
    };
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
}
