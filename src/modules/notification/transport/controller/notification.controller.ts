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
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { ApiNoContent } from '@/common/swagger/swagger-decorators';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
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
import {
  NOTIFICATION_ANALYTICS_EXAMPLE,
  NOTIFICATION_DELETED_READ_EXAMPLE,
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
    );

    return this.presenter.getNotifications(result);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
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
  @ApiOperation({
    summary: 'Get notification analytics',
    description:
      'Returns platform-wide notification analytics. Requires `NOTIFICATION_ANALYTICS` permission. ' +
      'Authentication via Bearer token is required.',
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
  @ApiOperation({ summary: 'Get notification preferences' })
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
  @ApiOperation({ summary: 'Update notification preferences' })
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
  @ApiOperation({ summary: 'Get notification detail' })
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
  // Phase 5 (rev5.1): `notificationApplicationService.getNotificationDetail`
  // throws `NotificationNotFoundError` if the notification does not
  // exist (or was deleted). Pre-Phase-5 this error fell through the
  // global filter's `instanceof Error` branch as a misleading 500
  // (the message was preserved but the status was wrong). After Phase
  // 5 the global filter resolves `NOTIFICATION_NOT_FOUND` → 404 via
  // `ProblemCodeMapping`. Documented here so the OpenAPI spec is
  // accurate. No `@ApiForbiddenResponse` because this endpoint
  // doesn't check ownership (any authenticated user with the
  // notificationId is allowed to read the detail — actually, the
  // service DOES check ownership via the `user.sub` filter in the
  // repository, but a missing notification surfaces as 404, not 403,
  // because the lookup is filtered by userId).
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
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.notificationService.getNotificationDetail(notificationId, user);
    return this.presenter.getNotificationDetail(result);
  }

  @Post(':notificationId/read')
  @Transactional()
  @ApiNoContent('Notification marked as read')
  @ApiParam({
    name: 'notificationId',
    type: String,
    format: 'uuid',
    description: 'Notification UUID',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  // Phase 5 (rev5.1): `notificationApplicationService.markAsRead`
  // throws `NotificationNotFoundError` (404) if the notification
  // doesn't exist, and `NotificationForbiddenError` (403) if the
  // notification belongs to a different user. Both were 500
  // catch-alls pre-Phase-5; both are correctly resolved by the
  // global filter post-Phase-5 via `ProblemCodeMapping`.
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
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.markAsRead(notificationId, user);
  }

  @Post(':notificationId/unread')
  @Transactional()
  @ApiNoContent('Notification marked as unread')
  @ApiParam({
    name: 'notificationId',
    type: String,
    format: 'uuid',
    description: 'Notification UUID',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  // Phase 5 (rev5.1): same 404 + 403 wiring as `markAsRead`. See
  // the docblock there for rationale. Pre-Phase-5 both errors were
  // 500 catch-alls; post-Phase-5 they resolve correctly via
  // `ProblemCodeMapping`.
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
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
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
    example: NOTIFICATION_DELETED_READ_EXAMPLE,
  })
  async deleteReadNotifications(@CurrentUser() user: JwtPayload) {
    const deletedCount = await this.notificationService.deleteReadNotifications(user);
    return this.presenter.deleteReadNotifications({ deletedCount });
  }

  @Delete(':notificationId')
  @Transactional()
  @ApiNoContent('Notification deleted')
  @ApiParam({
    name: 'notificationId',
    type: String,
    format: 'uuid',
    description: 'Notification UUID',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  // Phase 5 (rev5.1): same 404 + 403 wiring as `markAsRead`. See
  // the docblock there for rationale. Pre-Phase-5 both errors were
  // 500 catch-alls; post-Phase-5 they resolve correctly via
  // `ProblemCodeMapping`.
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
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.notificationService.deleteNotification(notificationId, user);
  }
}
