import { Controller, Get, Post, Delete, Param, Query, ParseIntPipe, DefaultValuePipe, Body } from '@nestjs/common';
import { NotificationApplicationService } from '@/modules/notification/application/notification-application.service';
import { NotificationListResponseDto, NotificationResponseDto } from '@/modules/notification/dto/response';
import { RequireAuth } from '@/common/guards/jwt.guard';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { User } from '@/common/decorators/user.decorator';

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
  ): Promise<NotificationListResponseDto> {
    const parsedCursor = cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString()) : null;

    const result = await this.notificationService.getNotifications(
      user,
      limit,
      parsedCursor,
      unreadOnly,
    );

    return {
      items: result.items.map(n => ({
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

  @Post(':notificationId/read')
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @User() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.notificationService.markAsRead(notificationId, user);
    return { message: 'Notification marked as read' };
  }

  @Post('read-all')
  async markAllAsRead(@User() user: JwtPayload): Promise<{ message: string }> {
    await this.notificationService.markAllAsRead(user);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':notificationId')
  async deleteNotification(
    @Param('notificationId') notificationId: string,
    @User() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.notificationService.deleteNotification(notificationId, user);
    return { message: 'Notification deleted' };
  }
}
