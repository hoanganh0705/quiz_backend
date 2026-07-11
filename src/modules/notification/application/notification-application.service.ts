import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { paginated, type PaginatedResult } from '@/common/responses/paginated-result';
import { NotificationService } from '../domain/notification.service';
import {
  NOTIFICATION_REPOSITORY_PORT,
  NOTIFICATION_DOMAIN_EVENT_BUS,
  NOTIFICATION_CHANNEL_SERVICE_INSTANCE,
  type NotificationRepositoryPort,
  type NotificationDomainEventBus,
  type NotificationChannelServiceInstance,
} from '../domain/ports/notification-ports';
import { NotificationForbiddenError, NotificationNotFoundError } from '../domain/errors';
import type {
  NotificationReadEvent,
  NotificationUnreadEvent,
  NotificationDeletedEvent,
} from '../domain/events/notification.events';
import type {
  Notification as DomainNotification,
  NotificationListParams,
  UpdatePreferencesParams,
  NotificationPreferencesRow,
} from '../domain/types/notification.types';
import type {
  NotificationPreferencesResponseDto,
  NotificationResponseDto,
} from '../dto/response/notification-response.dto';

const toNotificationDto = (n: DomainNotification): NotificationResponseDto => ({
  notificationId: n.notificationId,
  userId: n.userId,
  type: n.type,
  title: n.title,
  message: n.message,
  metadata: n.metadata,
  channel: n.channel,
  isRead: n.isRead,
  readAt: n.readAt,
  createdAt: n.createdAt,
  expiresAt: n.expiresAt,
});

const toPreferencesDto = (
  prefs: NotificationPreferencesRow,
): NotificationPreferencesResponseDto => ({
  inAppEnabled: prefs.inAppEnabled,
  emailEnabled: prefs.emailEnabled,
  pushEnabled: prefs.pushEnabled,
  achievementEnabled: prefs.achievementEnabled,
  tournamentEnabled: prefs.tournamentEnabled,
  rankEnabled: prefs.rankEnabled,
  friendEnabled: prefs.friendEnabled,
  discussionEnabled: prefs.discussionEnabled,
  summaryEnabled: prefs.summaryEnabled,
  marketingEnabled: prefs.marketingEnabled,
  rankImprovementThreshold: prefs.rankImprovementThreshold,
  quietHoursStart: prefs.quietHoursStart,
  quietHoursEnd: prefs.quietHoursEnd,
});

@Injectable()
export class NotificationApplicationService {
  constructor(
    private readonly notificationService: NotificationService,
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
    @Inject(NOTIFICATION_DOMAIN_EVENT_BUS)
    private readonly eventBus: NotificationDomainEventBus,
    @Optional()
    @Inject(NOTIFICATION_CHANNEL_SERVICE_INSTANCE)
    private readonly channelServiceInstance?: NotificationChannelServiceInstance,
    @Optional()
    @InjectPinoLogger(NotificationApplicationService.name)
    private readonly logger?: PinoLogger,
  ) {}

  async getNotifications(
    user: JwtPayload,
    limit: number,
    cursor?: { createdAt: string; notificationId: string } | null,
    unreadOnly?: boolean,
    includeArchived?: boolean,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    const params: NotificationListParams = { limit, cursor, unreadOnly, includeArchived };

    const notifications = await this.notificationService.getNotifications(user.sub, params);

    const hasNextPage = notifications.length > limit;
    const items = hasNextPage ? notifications.slice(0, limit) : notifications;
    const tail = items[items.length - 1];
    const nextCursor =
      hasNextPage && tail
        ? Buffer.from(
            JSON.stringify({ createdAt: tail.createdAt, notificationId: tail.notificationId }),
          ).toString('base64')
        : null;

    return paginated(
      items.map((item) => toNotificationDto(item)),
      {
        kind: 'cursor',
        limit,
        hasNextPage,
        nextCursor,
      },
    );
  }

  async getNotificationDetail(
    notificationId: string,
    user: JwtPayload,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationService.getNotification(notificationId, user.sub);

    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    return toNotificationDto(notification);
  }

  async markAsRead(notificationId: string, user: JwtPayload): Promise<void> {
    const notification = await this.notificationService.getNotification(notificationId, user.sub);

    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    if (notification.userId !== user.sub) {
      throw new NotificationForbiddenError();
    }

    await this.notificationRepository.markAsRead(notificationId, user.sub);

    const readEvent: NotificationReadEvent = {
      eventType: 'notification.read',
      notificationId,
      userId: user.sub,
      timestamp: new Date(),
    };
    this.eventBus.emit(readEvent);

    this.logger?.info({
      event: 'notification_marked_read',
      notificationId,
      userId: user.sub,
    });
  }

  async markAsUnread(notificationId: string, user: JwtPayload): Promise<void> {
    const notification = await this.notificationService.getNotification(notificationId, user.sub);

    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    if (notification.userId !== user.sub) {
      throw new NotificationForbiddenError();
    }

    await this.notificationRepository.markAsUnread(notificationId, user.sub);

    const unreadEvent: NotificationUnreadEvent = {
      eventType: 'notification.unread',
      notificationId,
      userId: user.sub,
      timestamp: new Date(),
    };
    this.eventBus.emit(unreadEvent);

    this.logger?.info({
      event: 'notification_marked_unread',
      notificationId,
      userId: user.sub,
    });
  }

  async markAllAsRead(user: JwtPayload): Promise<void> {
    await this.notificationRepository.markAllAsRead(user.sub);

    this.logger?.info({
      event: 'all_notifications_marked_read',
      userId: user.sub,
    });
  }

  async deleteReadNotifications(user: JwtPayload): Promise<number> {
    const deletedCount = await this.notificationRepository.deleteReadNotifications(user.sub);

    this.logger?.info({
      event: 'read_notifications_deleted',
      userId: user.sub,
      deletedCount,
    });

    return deletedCount;
  }

  async deleteNotification(notificationId: string, user: JwtPayload): Promise<void> {
    const notification = await this.notificationService.getNotification(notificationId, user.sub);

    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    if (notification.userId !== user.sub) {
      throw new NotificationForbiddenError();
    }

    await this.notificationRepository.delete(notificationId, user.sub);

    const deletedEvent: NotificationDeletedEvent = {
      eventType: 'notification.deleted',
      notificationId,
      userId: user.sub,
      timestamp: new Date(),
    };
    this.eventBus.emit(deletedEvent);

    this.logger?.info({
      event: 'notification_deleted',
      notificationId,
      userId: user.sub,
    });
  }

  async getUnreadCount(user: JwtPayload): Promise<number> {
    return this.notificationService.getUnreadCount(user.sub);
  }

  async getAnalytics(): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    last24h: number;
    last7d: number;
  }> {
    return this.notificationRepository.getAnalytics();
  }

  async updatePreferences(
    user: JwtPayload,
    params: UpdatePreferencesParams,
  ): Promise<NotificationPreferencesResponseDto> {
    const result = await this.notificationRepository.upsertPreferences(user.sub, params);
    await this.channelServiceInstance?.invalidatePreferencesCache(user.sub);
    return toPreferencesDto(result);
  }

  async getOrCreatePreferences(user: JwtPayload): Promise<NotificationPreferencesResponseDto> {
    const existing = await this.notificationRepository.getPreferences(user.sub);
    if (existing) {
      return toPreferencesDto(existing);
    }
    const created = await this.notificationRepository.upsertPreferences(user.sub, {});
    return toPreferencesDto(created);
  }
}
