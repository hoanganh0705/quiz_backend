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
import { ListMyDiscussionsQueryDto } from '@/modules/discussion/dto/request';
import { MyDiscussionsResponseDto } from '@/modules/discussion/dto/response';
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
