import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
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
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const ANALYTICS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const ANALYTICS_CACHE_KEY = 'notif:analytics:platform';

export function generateNotificationIdempotencyKey(
  type: string,
  userId: string,
  eventId: string,
): string {
  return `notif:${type}:${userId}:${eventId}`;
}

@Injectable()
export class NotificationRepository implements NotificationRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional()
    @Inject(TRANSACTIONAL_CONTEXT)
    private readonly transactionalContext?: TransactionalContext,
    @Optional()
    @Inject(CACHE_PROVIDER)
    private readonly cache?: CacheProvider,
    @Optional()
    @InjectPinoLogger(NotificationRepository.name)
    private readonly logger?: PinoLogger,
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

  /**
   * Check if a notification with the given idempotency key already exists.
   * Returns the existing notification if found, null otherwise.
   */
  async findByIdempotencyKey(
    idempotencyKey: string,
    userId: string,
  ): Promise<DomainNotification | null> {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          sql`metadata->>'idempotencyKey' = ${idempotencyKey}`,
          eq(notifications.userId, userId),
          isNull(notifications.deletedAt),
        ),
      );

    return notification ? this.mapToNotification(notification) : null;
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

    if (params.fromDate) {
      conditions.push(sql`${notifications.createdAt} >= ${params.fromDate}`);
    }

    if (params.toDate) {
      conditions.push(sql`${notifications.createdAt} <= ${params.toDate}`);
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

  async markAllAsRead(userId: string): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.getDb()
      .update(notifications)
      .set({ isRead: true, readAt: now })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
          isNull(notifications.deletedAt),
        ),
      );

    return Number(result.rowCount ?? 0);
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

  /**
   * Alias for softDelete to satisfy the repository interface contract.
   * All deletes in this module are soft deletes; hard deletes only occur
   * via `deleteExpired()` for records past their expiresAt.
   *
   * Phase 6 (rev6.1): added this clarifying comment. The delegation
   * from `delete()` to `softDelete()` is intentional — the interface
   * declares `delete()` but the implementation always performs a soft delete.
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    await this.softDelete(notificationId, userId);
  }

  /**
   * Performs a soft delete by setting `deletedAt` to the current timestamp.
   * The record remains in the database but is excluded from normal queries
   * via the `isNull(deletedAt)` filter applied in all read operations.
   */
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
    if (this.cache) {
      const cached = await this.cache.get(ANALYTICS_CACHE_KEY);
      if (cached) {
        try {
          this.logger?.debug({ event: 'analytics_cache_hit' });
          return JSON.parse(cached) as ReturnType<typeof this.getAnalyticsUncached>;
        } catch {
          this.logger?.warn({ event: 'analytics_cache_parse_failed' });
        }
      }
    }

    const result = await this.getAnalyticsUncached();

    if (this.cache) {
      await this.cache.set(ANALYTICS_CACHE_KEY, JSON.stringify(result), ANALYTICS_CACHE_TTL_MS);
    }

    return result;
  }

  /**
   * Invalidate the analytics cache.
   * Call this after significant notification activity.
   */
  async invalidateAnalyticsCache(): Promise<void> {
    if (this.cache) {
      await this.cache.del(ANALYTICS_CACHE_KEY);
      this.logger?.info({ event: 'analytics_cache_invalidated' });
    }
  }

  private async getAnalyticsUncached(): Promise<{
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
