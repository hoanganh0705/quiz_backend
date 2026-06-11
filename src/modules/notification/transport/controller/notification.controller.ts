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
import { ApiTags } from '@nestjs/swagger';
import { ApiNoContent } from '@/common/swagger/swagger-decorators';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import { NotificationApplicationService } from '@/modules/notification/application/notification-application.service';
import {
  NotificationListResponseDto,
  NotificationPreferencesResponseDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
  DeletedReadNotificationsResponseDto,
  NotificationAnalyticsDto,
} from '@/modules/notification/dto/response';
import { RequireAuth } from '@/common/guards/jwt.guard';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { User } from '@/common/decorators/user.decorator';
import { UpdatePreferencesDto, GetNotificationsQueryDto } from '@/modules/notification/dto/request';
import { Roles } from '@/common/authorization/decorators/roles.decorator';

@ApiTags('notification')
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
  async getUnreadCount(@User() user: JwtPayload): Promise<UnreadCountResponseDto> {
    const count = await this.notificationService.getUnreadCount(user);
    return { count };
  }

  @Get('analytics')
  @Roles('admin')
  async getAnalytics(): Promise<NotificationAnalyticsDto> {
    return this.notificationService.getAnalytics();
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
      expiresAt: notification.expiresAt,
    };
  }

  @Post(':notificationId/read')
  @Transactional()
  @ApiNoContent()
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.markAsRead(notificationId, user);
  }

  @Post(':notificationId/unread')
  @Transactional()
  @ApiNoContent()
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsUnread(
    @Param('notificationId') notificationId: string,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.markAsUnread(notificationId, user);
  }

  @Post('read-all')
  @Transactional()
  @ApiNoContent()
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(@User() user: JwtPayload): Promise<void> {
    await this.notificationService.markAllAsRead(user);
  }

  @Delete('read')
  @Transactional()
  async deleteReadNotifications(
    @User() user: JwtPayload,
  ): Promise<DeletedReadNotificationsResponseDto> {
    const deletedCount = await this.notificationService.deleteReadNotifications(user);
    return { deletedCount };
  }

  @Delete(':notificationId')
  @Transactional()
  @ApiNoContent()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('notificationId') notificationId: string,
    @User() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.deleteNotification(notificationId, user);
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
      discussionEnabled: prefs.discussionEnabled,
      summaryEnabled: prefs.summaryEnabled,
      marketingEnabled: prefs.marketingEnabled,
      rankImprovementThreshold: prefs.rankImprovementThreshold,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
    };
  }
}
