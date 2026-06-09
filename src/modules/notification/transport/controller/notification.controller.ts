import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Body,
} from '@nestjs/common';
import { NotificationApplicationService } from '@/modules/notification/application/notification-application.service';
import {
  NotificationListResponseDto,
  NotificationPreferencesResponseDto,
  NotificationResponseDto,
} from '@/modules/notification/dto/response';
import { RequireAuth } from '@/common/guards/jwt.guard';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { User } from '@/common/decorators/user.decorator';
import { UpdatePreferencesDto, GetNotificationsQueryDto } from '@/modules/notification/dto/request';

@Controller('notifications')
@RequireAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationApplicationService) {}

  @Get()
  async getNotifications(
    @User() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
    @Query('unreadOnly', new DefaultValuePipe(false)) unreadOnly?: boolean,
    @Query() query?: GetNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    const parsedCursor: { createdAt: string; notificationId: string } | null = cursor
      ? (JSON.parse(Buffer.from(cursor, 'base64').toString()) as {
          createdAt: string;
          notificationId: string;
        })
      : null;

    const result = await this.notificationService.getNotifications(
      user,
      limit,
      parsedCursor,
      unreadOnly,
      query?.includeArchived,
    );

    return {
      items: result.items.map((n) => ({
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
      })),
      unreadCount: result.unreadCount,
      hasNextPage: result.hasNextPage,
    };
  }

  @Get('unread-count')
  async getUnreadCount(@User() user: JwtPayload): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadCount(user);
    return { count };
  }

  @Get(':notificationId')
  async getNotificationDetail(
    @Param('notificationId') notificationId: string,
    @User() user: JwtPayload,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationService.getNotificationDetail(notificationId, user);

    return {
      notificationId: notification.notificationId,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      channel: notification.channel,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }

  @Post(':notificationId/read')
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @User() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.notificationService.markAsRead(notificationId, user);
    return { message: 'Notification marked as read' };
  }

  @Post(':notificationId/unread')
  async markAsUnread(
    @Param('notificationId') notificationId: string,
    @User() user: JwtPayload,
  ): Promise<{ success: true; notificationId: string; read: false }> {
    await this.notificationService.markAsUnread(notificationId, user);
    return {
      success: true,
      notificationId,
      read: false,
    };
  }

  @Post('read-all')
  async markAllAsRead(@User() user: JwtPayload): Promise<{ message: string }> {
    await this.notificationService.markAllAsRead(user);
    return { message: 'All notifications marked as read' };
  }

  @Delete('read')
  async deleteReadNotifications(
    @User() user: JwtPayload,
  ): Promise<{ success: true; deletedCount: number }> {
    const deletedCount = await this.notificationService.deleteReadNotifications(user);
    return {
      success: true,
      deletedCount,
    };
  }

  @Delete(':notificationId')
  async deleteNotification(
    @Param('notificationId') notificationId: string,
    @User() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.notificationService.deleteNotification(notificationId, user);
    return { message: 'Notification deleted' };
  }

  // Preferences endpoints
  @Get('preferences')
  async getPreferences(@User() user: JwtPayload): Promise<NotificationPreferencesResponseDto> {
    const prefs = await this.notificationService.getOrCreatePreferences(user);
    return {
      inAppEnabled: prefs.inAppEnabled,
      emailEnabled: prefs.emailEnabled,
      pushEnabled: prefs.pushEnabled,
      achievementEnabled: prefs.achievementEnabled,
      tournamentEnabled: prefs.tournamentEnabled,
      rankEnabled: prefs.rankEnabled,
      friendEnabled: prefs.friendEnabled,
      summaryEnabled: prefs.summaryEnabled,
      marketingEnabled: prefs.marketingEnabled,
      rankImprovementThreshold: prefs.rankImprovementThreshold,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
    };
  }

  @Patch('preferences')
  async updatePreferences(
    @User() user: JwtPayload,
    @Body() updateDto: UpdatePreferencesDto,
  ): Promise<NotificationPreferencesResponseDto> {
    const prefs = await this.notificationService.updatePreferences(user, updateDto);
    return {
      inAppEnabled: prefs.inAppEnabled,
      emailEnabled: prefs.emailEnabled,
      pushEnabled: prefs.pushEnabled,
      achievementEnabled: prefs.achievementEnabled,
      tournamentEnabled: prefs.tournamentEnabled,
      rankEnabled: prefs.rankEnabled,
      friendEnabled: prefs.friendEnabled,
      summaryEnabled: prefs.summaryEnabled,
      marketingEnabled: prefs.marketingEnabled,
      rankImprovementThreshold: prefs.rankImprovementThreshold,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
    };
  }
}
