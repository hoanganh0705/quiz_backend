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
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiOkResponse } from '@nestjs/swagger';
import { ApiNoContent, ApiAuthAction, ApiBadRequest } from '@/common/swagger/swagger-decorators';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import { NotificationApplicationService } from '@/modules/notification/application/notification-application.service';
import {
  NotificationListResponseDto,
  NotificationResponseDto,
  NotificationPreferencesResponseDto,
  UnreadCountResponseDto,
  DeletedReadNotificationsResponseDto,
  NotificationAnalyticsDto,
  WrappedNotificationListResponseDto,
  WrappedNotificationResponseDto,
  WrappedNotificationPreferencesResponseDto,
  WrappedUnreadCountResponseDto,
  WrappedDeletedReadNotificationsResponseDto,
  WrappedNotificationAnalyticsDto,
} from '@/modules/notification/dto/response';
import { RequireAuth } from '@/common/guards/jwt.guard';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { UpdatePreferencesDto, GetNotificationsQueryDto } from '@/modules/notification/dto/request';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('notifications')
@Controller('notifications')
@RequireAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationApplicationService) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description: 'Returns paginated notifications for the authenticated user.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Base64-encoded cursor for pagination',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiZGlzdGluY3Rpb25JZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMDAifQ==',
  })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    description: 'Filter to unread notifications only',
    example: false,
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    description: 'Include archived notifications',
    example: false,
  })
  @ApiOkResponse({ type: WrappedNotificationListResponseDto })
  async getNotifications(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
    @Query('unreadOnly', new DefaultValuePipe(false)) unreadOnly?: boolean,
    @Query() query?: GetNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    let parsedCursor: { createdAt: string; notificationId: string } | null = null;

    if (cursor) {
      try {
        parsedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString()) as {
          createdAt: string;
          notificationId: string;
        };
      } catch {
        throw new BadRequestException('Invalid cursor parameter');
      }
    }

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
        expiresAt: n.expiresAt,
      })),
      unreadCount: result.unreadCount,
      hasNextPage: result.hasNextPage,
    };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiOkResponse({ type: WrappedUnreadCountResponseDto })
  async getUnreadCount(@CurrentUser() user: JwtPayload): Promise<UnreadCountResponseDto> {
    const count = await this.notificationService.getUnreadCount(user);
    return { count };
  }

  @Get('analytics')
  @Permissions(Permission.NOTIFICATION_ANALYTICS)
  @ApiOperation({ summary: 'Get notification analytics' })
  @ApiOkResponse({ type: WrappedNotificationAnalyticsDto })
  async getAnalytics(): Promise<NotificationAnalyticsDto> {
    return this.notificationService.getAnalytics();
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiOkResponse({ type: WrappedNotificationPreferencesResponseDto })
  async getPreferences(
    @CurrentUser() user: JwtPayload,
  ): Promise<NotificationPreferencesResponseDto> {
    const prefs = await this.notificationService.getOrCreatePreferences(user);
    return {
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
    };
  }

  @Patch('preferences')
  @Transactional()
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiBadRequest()
  @ApiOkResponse({ type: WrappedNotificationPreferencesResponseDto })
  async updatePreferences(
    @CurrentUser() user: JwtPayload,
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
      discussionEnabled: prefs.discussionEnabled,
      summaryEnabled: prefs.summaryEnabled,
      marketingEnabled: prefs.marketingEnabled,
      rankImprovementThreshold: prefs.rankImprovementThreshold,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
    };
  }

  @Get(':notificationId')
  @ApiOperation({ summary: 'Get notification detail' })
  @ApiOkResponse({ type: WrappedNotificationResponseDto })
  async getNotificationDetail(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: JwtPayload,
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
      expiresAt: notification.expiresAt,
    };
  }

  @Post(':notificationId/read')
  @Transactional()
  @ApiNoContent('Notification marked as read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.markAsRead(notificationId, user);
  }

  @Post(':notificationId/unread')
  @Transactional()
  @ApiNoContent('Notification marked as unread')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsUnread(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.markAsUnread(notificationId, user);
  }

  @Post('read-all')
  @Transactional()
  @ApiNoContent('All notifications marked as read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.notificationService.markAllAsRead(user);
  }

  @Delete('read')
  @Transactional()
  @ApiAuthAction({
    description: 'Read notifications deleted',
    type: WrappedDeletedReadNotificationsResponseDto,
  })
  async deleteReadNotifications(
    @CurrentUser() user: JwtPayload,
  ): Promise<DeletedReadNotificationsResponseDto> {
    const deletedCount = await this.notificationService.deleteReadNotifications(user);
    return { deletedCount };
  }

  @Delete(':notificationId')
  @Transactional()
  @ApiNoContent('Notification deleted')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.deleteNotification(notificationId, user);
  }
}
