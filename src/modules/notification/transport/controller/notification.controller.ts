import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiParam, ApiNotFoundResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiAuthAction, ApiAuthActionNoContent } from '@/common/swagger/swagger-decorators';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import { NotificationApplicationService } from '@/modules/notification/application/notification-application.service';
import {
  NotificationResponseDto,
  NotificationPreferencesResponseDto,
  UnreadCountResponseDto,
  NotificationAnalyticsDto,
} from '@/modules/notification/dto/response';
import { NotificationPresenter } from '../presenters/notification.presenter';
import { ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { JwtGuard, type JwtPayload } from '@/common/guards/jwt.guard';
import { UpdatePreferencesDto, GetNotificationsQueryDto } from '@/modules/notification/dto/request';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { NOTIFICATION_THROTTLE_VALUES } from '@/core/config/notification-throttle.config';
import {
  NOTIFICATION_ANALYTICS_EXAMPLE,
  NOTIFICATION_DETAIL_EXAMPLE,
  NOTIFICATION_LIST_EXAMPLE,
  NOTIFICATION_PREFERENCES_EXAMPLE,
  NOTIFICATION_PREFERENCES_UPDATE_EXAMPLE,
  NOTIFICATION_UNREAD_COUNT_EXAMPLE,
} from '../swagger/examples/notification.examples';
import {
  getNotificationNotFoundExample,
  markAsReadNotFoundExample,
  markAsReadForbiddenExample,
  markAsUnreadNotFoundExample,
  markAsUnreadForbiddenExample,
  deleteNotificationNotFoundExample,
  deleteNotificationForbiddenExample,
} from '../swagger/examples/errors.examples';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationApplicationService,
    private readonly presenter: NotificationPresenter,
  ) {}

  @Get()
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.listNotifications })
  @ApiAuthAction({
    summary: 'List notifications',
    description: 'Returns cursor-paginated notifications for the authenticated user.',
    operationId: 'getNotifications',
  })
  @ApiOkResourceList(NotificationResponseDto, 'cursor', {
    description:
      'Cursor-paginated list of notifications. The `unreadCount` is no longer carried ' +
      'inside this payload — call `GET /notifications/unread-count` for that.',
    example: NOTIFICATION_LIST_EXAMPLE,
  })
  async getNotifications(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetNotificationsQueryDto,
  ) {
    let parsedCursor: { createdAt: string; notificationId: string } | null = null;
    const limit = query.limit ?? 20;

    if (query.cursor) {
      try {
        parsedCursor = JSON.parse(Buffer.from(query.cursor, 'base64').toString()) as {
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
      query.unreadOnly,
      query.includeArchived,
      query.type,
      query.fromDate,
      query.toDate,
    );

    return this.presenter.getNotifications(result);
  }

  @Get('unread-count')
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.getUnreadCount })
  @ApiAuthAction({
    summary: 'Get unread notification count',
    operationId: 'getUnreadCount',
  })
  @ApiOkResource(UnreadCountResponseDto, {
    description: 'Unread notification count',
    example: NOTIFICATION_UNREAD_COUNT_EXAMPLE,
  })
  async getUnreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.notificationService.getUnreadCount(user);
    return this.presenter.getUnreadCount({ count });
  }

  @Get('analytics')
  @Permissions(Permission.NOTIFICATION_ANALYTICS)
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.getAnalytics })
  @ApiAuthAction({
    summary: 'Get notification analytics',
    description:
      'Returns platform-wide notification analytics. Requires `NOTIFICATION_ANALYTICS` permission. ' +
      'Authentication via Bearer token is required.',
    operationId: 'getNotificationAnalytics',
  })
  @ApiOkResource(NotificationAnalyticsDto, {
    description: 'Notification analytics',
    example: NOTIFICATION_ANALYTICS_EXAMPLE,
  })
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
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.getPreferences })
  @ApiAuthAction({
    summary: 'Get notification preferences',
    operationId: 'getNotificationPreferences',
  })
  @ApiOkResource(NotificationPreferencesResponseDto, {
    description: 'Notification preferences',
    example: NOTIFICATION_PREFERENCES_EXAMPLE,
  })
  async getPreferences(@CurrentUser() user: JwtPayload) {
    const result = await this.notificationService.getOrCreatePreferences(user);
    return this.presenter.getPreferences(result);
  }

  @Patch('preferences')
  @Transactional()
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.updatePreferences })
  @ApiAuthAction({
    summary: 'Update notification preferences',
    operationId: 'updateNotificationPreferences',
  })
  @ApiOkResource(NotificationPreferencesResponseDto, {
    description: 'Notification preferences',
    example: NOTIFICATION_PREFERENCES_UPDATE_EXAMPLE,
  })
  async updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() updateDto: UpdatePreferencesDto,
  ) {
    const result = await this.notificationService.updatePreferences(user, updateDto);
    return this.presenter.updatePreferences(result);
  }

  @Get(':notificationId')
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.getNotificationDetail })
  @ApiAuthAction({
    summary: 'Get notification detail',
    operationId: 'getNotificationDetail',
  })
  @ApiParam({
    name: 'notificationId',
    type: String,
    format: 'uuid',
    description: 'Notification UUID',
  })
  @ApiOkResource(NotificationResponseDto, {
    description: 'Notification detail',
    example: NOTIFICATION_DETAIL_EXAMPLE,
  })
  @ApiNotFoundResponse({
    description:
      'No notification exists with this `notificationId` for the authenticated user. ' +
      '`notificationApplicationService.getNotificationDetail` throws `NotificationNotFoundError` ' +
      'which `GlobalExceptionFilter` emits as RFC 7807 `ProblemDetailDto` with ' +
      "`extensions.code = 'NOTIFICATION_NOT_FOUND'`.",
    type: ProblemDetailDto,
    example: getNotificationNotFoundExample,
  })
  async getNotificationDetail(
    @Param('notificationId', new ParseUUIDPipe({ version: '7' })) notificationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.notificationService.getNotificationDetail(notificationId, user);
    return this.presenter.getNotificationDetail(result);
  }

  @Post(':notificationId/read')
  @Transactional()
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.markAsRead })
  @ApiAuthActionNoContent('Notification marked as read')
  @ApiParam({
    name: 'notificationId',
    type: String,
    format: 'uuid',
    description: 'Notification UUID',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNotFoundResponse({
    description:
      'No notification exists with this `notificationId`. ' +
      '`notificationApplicationService.markAsRead` throws `NotificationNotFoundError` ' +
      'which `GlobalExceptionFilter` emits as RFC 7807 `ProblemDetailDto` with ' +
      "`extensions.code = 'NOTIFICATION_NOT_FOUND'`.",
    type: ProblemDetailDto,
    example: markAsReadNotFoundExample,
  })
  @ApiForbiddenResponse({
    description:
      'The notification exists but belongs to a different user. ' +
      '`notificationApplicationService.markAsRead` throws `NotificationForbiddenError` ' +
      'when `notification.userId !== user.sub`. `GlobalExceptionFilter` emits it as RFC 7807 ' +
      "`ProblemDetailDto` with `extensions.code = 'NOTIFICATION_FORBIDDEN'`.",
    type: ProblemDetailDto,
    example: markAsReadForbiddenExample,
  })
  async markAsRead(
    @Param('notificationId', new ParseUUIDPipe({ version: '7' })) notificationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.markAsRead(notificationId, user);
  }

  @Post(':notificationId/unread')
  @Transactional()
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.markAsUnread })
  @ApiAuthActionNoContent('Notification marked as unread')
  @ApiParam({
    name: 'notificationId',
    type: String,
    format: 'uuid',
    description: 'Notification UUID',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNotFoundResponse({
    description:
      'No notification exists with this `notificationId`. ' +
      '`notificationApplicationService.markAsUnread` throws `NotificationNotFoundError` ' +
      'which `GlobalExceptionFilter` emits as RFC 7807 `ProblemDetailDto` with ' +
      "`extensions.code = 'NOTIFICATION_NOT_FOUND'`.",
    type: ProblemDetailDto,
    example: markAsUnreadNotFoundExample,
  })
  @ApiForbiddenResponse({
    description:
      'The notification exists but belongs to a different user. ' +
      '`notificationApplicationService.markAsUnread` throws `NotificationForbiddenError` ' +
      'when `notification.userId !== user.sub`. `GlobalExceptionFilter` emits it as RFC 7807 ' +
      "`ProblemDetailDto` with `extensions.code = 'NOTIFICATION_FORBIDDEN'`.",
    type: ProblemDetailDto,
    example: markAsUnreadForbiddenExample,
  })
  async markAsUnread(
    @Param('notificationId', new ParseUUIDPipe({ version: '7' })) notificationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.markAsUnread(notificationId, user);
  }

  @Post('read-all')
  @Transactional()
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.markAllAsRead })
  @ApiAuthActionNoContent('All notifications marked as read')
  async markAllAsRead(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.notificationService.markAllAsRead(user);
  }

  @Delete('read-all')
  @Transactional()
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.deleteReadNotifications })
  @ApiAuthActionNoContent('Read notifications deleted')
  async deleteReadNotifications(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.notificationService.deleteReadNotifications(user);
  }

  @Delete(':notificationId')
  @Transactional()
  @Throttle({ default: NOTIFICATION_THROTTLE_VALUES.deleteNotification })
  @ApiAuthActionNoContent('Notification deleted')
  @ApiParam({
    name: 'notificationId',
    type: String,
    format: 'uuid',
    description: 'Notification UUID',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNotFoundResponse({
    description:
      'No notification exists with this `notificationId`. ' +
      '`notificationApplicationService.deleteNotification` throws `NotificationNotFoundError` ' +
      'which `GlobalExceptionFilter` emits as RFC 7807 `ProblemDetailDto` with ' +
      "`extensions.code = 'NOTIFICATION_NOT_FOUND'`.",
    type: ProblemDetailDto,
    example: deleteNotificationNotFoundExample,
  })
  @ApiForbiddenResponse({
    description:
      'The notification exists but belongs to a different user. ' +
      '`notificationApplicationService.deleteNotification` throws `NotificationForbiddenError` ' +
      'when `notification.userId !== user.sub`. `GlobalExceptionFilter` emits it as RFC 7807 ' +
      "`ProblemDetailDto` with `extensions.code = 'NOTIFICATION_FORBIDDEN'`.",
    type: ProblemDetailDto,
    example: deleteNotificationForbiddenExample,
  })
  async deleteNotification(
    @Param('notificationId', new ParseUUIDPipe({ version: '7' })) notificationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.deleteNotification(notificationId, user);
  }
}
