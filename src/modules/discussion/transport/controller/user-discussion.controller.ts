import { Controller, Get, Param, ParseUUIDPipe, Query, UseFilters } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import { DiscussionApplicationService } from '@/modules/discussion/application/discussion-application.service';
import {
  ListMyCommentsQueryDto,
  ListMyDiscussionsQueryDto,
  ListMyUpvotedThreadsQueryDto,
  ListMyUpvotedCommentsQueryDto,
  ListMyDiscussionSubscriptionsQueryDto,
} from '@/modules/discussion/dto/request';
import {
  MyCommentsResponseDto,
  MyDiscussionsResponseDto,
  MyUpvotedThreadsResponseDto,
  MyUpvotedCommentsResponseDto,
  MyDiscussionSubscriptionsResponseDto,
  PublicDiscussionProfileResponseDto,
} from '@/modules/discussion/dto/response';
import { MyCommentCursorMapper } from '@/modules/discussion/mappers/my-comment-cursor.mapper';
import { QuizDiscussionCursorMapper } from '@/modules/discussion/mappers/quiz-discussion-cursor.mapper';
import { DiscussionDomainExceptionFilter } from './filters/discussion-domain-exception.filter';

@ApiTags('users')
@Controller()
@UseFilters(DiscussionDomainExceptionFilter)
export class UserDiscussionController {
  constructor(private readonly discussionApplicationService: DiscussionApplicationService) {}

  @Get('users/:userId/discussions')
  @Public()
  @ApiOperation({
    summary: 'List user discussions',
    description:
      'Returns public discussion threads created by the specified user, cursor-paginated and ordered by newest first.',
  })
  @ApiOkResponse({
    description: 'User discussions returned',
    type: MyDiscussionsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listDiscussionsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ListMyDiscussionsQueryDto,
  ): Promise<MyDiscussionsResponseDto> {
    return this.discussionApplicationService.listDiscussionsByUser(userId, {
      limit: query.limit,
      cursor: query.cursor ? QuizDiscussionCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('users/:userId/comments')
  @Public()
  @ApiOperation({
    summary: 'List user comments',
    description:
      'Returns public comments created by the specified user, cursor-paginated and ordered by newest first.',
  })
  @ApiOkResponse({
    description: 'User comments returned',
    type: MyCommentsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listCommentsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ListMyCommentsQueryDto,
  ): Promise<MyCommentsResponseDto> {
    return this.discussionApplicationService.listCommentsByUser(userId, {
      limit: query.limit,
      cursor: query.cursor ? MyCommentCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('users/:userId/discussion-profile')
  @Public()
  @ApiOperation({
    summary: 'Get public discussion profile',
    description:
      'Returns the public discussion profile for the specified user including thread count, comment count, accepted answers, and reputation.',
  })
  @ApiOkResponse({
    description: 'Public discussion profile returned',
    type: PublicDiscussionProfileResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getPublicDiscussionProfile(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<PublicDiscussionProfileResponseDto> {
    return this.discussionApplicationService.getPublicDiscussionProfile(userId);
  }

  @Get('users/me/comments')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'My comments',
    description:
      'Returns comments created by the authenticated user, cursor-paginated and ordered by newest first.',
  })
  @ApiOkResponse({
    description: 'My comments returned',
    type: MyCommentsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyComments(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyCommentsQueryDto,
  ): Promise<MyCommentsResponseDto> {
    return this.discussionApplicationService.listMyComments(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? MyCommentCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('users/me/upvoted-threads')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'My upvoted threads',
    description:
      'Returns active discussion threads upvoted by the authenticated user, paginated and ordered by the most recent upvote first.',
  })
  @ApiOkResponse({
    description: 'Upvoted threads returned',
    type: MyUpvotedThreadsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyUpvotedThreads(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyUpvotedThreadsQueryDto,
  ): Promise<MyUpvotedThreadsResponseDto> {
    return this.discussionApplicationService.listMyUpvotedThreads(user, {
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('users/me/upvoted-comments')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'My upvoted comments',
    description:
      'Returns active discussion comments upvoted by the authenticated user, paginated and ordered by the most recent upvote first.',
  })
  @ApiOkResponse({
    description: 'Upvoted comments returned',
    type: MyUpvotedCommentsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyUpvotedComments(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyUpvotedCommentsQueryDto,
  ): Promise<MyUpvotedCommentsResponseDto> {
    return this.discussionApplicationService.listMyUpvotedComments(user, {
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('users/me/discussion-subscriptions')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'My discussion subscriptions',
    description:
      'Returns active discussion threads subscribed to by the authenticated user, paginated and ordered by the most recent subscription first.',
  })
  @ApiOkResponse({
    description: 'Discussion subscriptions returned',
    type: MyDiscussionSubscriptionsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyDiscussionSubscriptions(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyDiscussionSubscriptionsQueryDto,
  ): Promise<MyDiscussionSubscriptionsResponseDto> {
    return this.discussionApplicationService.listMyDiscussionSubscriptions(user, {
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('users/me/discussions')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'My discussions',
    description:
      'Returns discussion threads created by the authenticated user, cursor-paginated and ordered by newest first.',
  })
  @ApiOkResponse({
    description: 'My discussions returned',
    type: MyDiscussionsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyDiscussions(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyDiscussionsQueryDto,
  ): Promise<MyDiscussionsResponseDto> {
    return this.discussionApplicationService.listMyDiscussions(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? QuizDiscussionCursorMapper.parse(query.cursor) : null,
    });
  }
}
