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
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ApiNoContent } from '@/common/swagger/swagger-decorators';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import { NotificationApplicationService } from '@/modules/notification/application/notification-application.service';
import {
  NotificationResponseDto,
  NotificationPreferencesResponseDto,
  UnreadCountResponseDto,
  DeletedReadNotificationsResponseDto,
  NotificationAnalyticsDto,
} from '@/modules/notification/dto/response';
import { NotificationPresenter } from '../presenters/notification.presenter';
import { ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
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
  constructor(
    private readonly notificationService: NotificationApplicationService,
    private readonly presenter: NotificationPresenter,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description: 'Returns cursor-paginated notifications for the authenticated user.',
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
  @ApiOkResourceList(NotificationResponseDto, 'cursor', {
    description:
      'Cursor-paginated list of notifications. The `unreadCount` is no longer carried ' +
      'inside this payload — call `GET /notifications/unread-count` for that.',
  })
  async getNotifications(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
    @Query('unreadOnly', new DefaultValuePipe(false)) unreadOnly?: boolean,
    @Query() query?: GetNotificationsQueryDto,
  ) {
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

    return this.presenter.getNotifications(result);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiOkResource(UnreadCountResponseDto, { description: 'Unread notification count' })
  async getUnreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.notificationService.getUnreadCount(user);
    return this.presenter.getUnreadCount({ count });
  }

  @Get('analytics')
  @Permissions(Permission.NOTIFICATION_ANALYTICS)
  @ApiOperation({ summary: 'Get notification analytics' })
  @ApiOkResource(NotificationAnalyticsDto, { description: 'Notification analytics' })
  async getAnalytics() {
    const result = await this.notificationService.getAnalytics();
    const analytics: NotificationAnalyticsDto = {
      total: result.total,
      unread: result.unread,
      byType: result.byType,
      byChannel: result.byChannel,
      last24h: result.last24h,
      last7d: result.last7d,
    };
    return this.presenter.getAnalytics(analytics);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiOkResource(NotificationPreferencesResponseDto, { description: 'Notification preferences' })
  async getPreferences(@CurrentUser() user: JwtPayload) {
    const result = await this.notificationService.getOrCreatePreferences(user);
    return this.presenter.getPreferences(result);
  }

  @Patch('preferences')
  @Transactional()
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiOkResource(NotificationPreferencesResponseDto, { description: 'Notification preferences' })
  async updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() updateDto: UpdatePreferencesDto,
  ) {
    const result = await this.notificationService.updatePreferences(user, updateDto);
    return this.presenter.updatePreferences(result);
  }

  @Get(':notificationId')
  @ApiOperation({ summary: 'Get notification detail' })
  @ApiOkResource(NotificationResponseDto, { description: 'Notification detail' })
  async getNotificationDetail(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.notificationService.getNotificationDetail(notificationId, user);
    return this.presenter.getNotificationDetail(result);
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
  @ApiOkResource(DeletedReadNotificationsResponseDto, {
    description: 'Read notifications deleted',
  })
  async deleteReadNotifications(@CurrentUser() user: JwtPayload) {
    const deletedCount = await this.notificationService.deleteReadNotifications(user);
    return this.presenter.deleteReadNotifications({ deletedCount });
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
