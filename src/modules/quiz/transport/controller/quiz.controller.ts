import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import {
  ApiAuth,
  ApiAuthList,
  ApiAuthCreate,
  ApiPublicList,
  ApiConflict,
  ApiAuthUpdateWithState,
} from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizApplicationService } from '../../application/quiz.application.service';
import { QuizVersionApplicationService } from '../../application/quiz-version.application.service';
import { QuizQuestionApplicationService } from '../../application/quiz-question.application.service';
import { CreateQuizDto } from '../../dto/request/create-quiz.dto';
import { QuizResponseDto } from '../../dto/response/quiz-response.dto';
import { QuizListResponseDto } from '../../dto/response/quiz-list-response.dto';
import { QuizStatsResponseDto } from '../../dto/response/quiz-stats-response.dto';
import {
  CreatorQuizAnalyticsDto,
  PopularQuizzesResponseDto,
  TrendingQuizzesResponseDto,
} from '../../dto/response/quiz-analytics.dto';
import { FeaturedQuizzesQueryDto } from '../../dto/request/featured-quizzes-query.dto';
import { RelatedQuizzesQueryDto } from '../../dto/request/related-quizzes-query.dto';
import { RelatedQuizzesResponseDto } from '../../dto/response/related-quizzes-response.dto';
import { ListQuizzesQueryDto } from '../../dto/request/list-quizzes-query.dto';
import { UpdateQuizDto } from '@/modules/quiz/dto/request/update-quiz.dto';
import { DeleteQuizResponseDto } from '@/modules/quiz/dto/response/delete-quiz-response.dto';
import { CreateQuizVersionDto } from '../../dto/request/create-quiz-version.dto';
import { UpdateQuizVersionDto } from '../../dto/request/update-quiz-version.dto';
import { ListQuizVersionsQueryDto } from '../../dto/request/list-quiz-versions-query.dto';
import { QuizVersionListResponseDto } from '../../dto/response/quiz-version-list-response.dto';
import { CreateQuizQuestionDto } from '@/modules/quiz/dto/request/create-quiz-question.dto';
import { CreateQuizQuestionsDto } from '@/modules/quiz/dto/request/create-quiz-questions.dto';
import { QuizQuestionResponseDto } from '@/modules/quiz/dto/response/quiz-question-response.dto';
import { QuizDomainExceptionFilter } from '../filters/quiz-domain-exception.filter';
import {
  QuizVersionDetailResponseDto,
  QuizVersionResponseDto,
} from '../../dto/response/quiz-version-response.dto';
import {
  WrappedQuizResponseDto,
  WrappedQuizListDto,
  WrappedQuizVersionListDto,
  WrappedQuizVersionResponseDto,
  WrappedTrendingQuizzesDto,
  WrappedPopularQuizzesDto,
  WrappedCreatorAnalyticsDto,
  WrappedQuizStatsDto,
  WrappedRelatedQuizzesDto,
  WrappedMessageDto,
  WrappedQuizQuestionDto,
  WrappedQuizQuestionArrayDto,
} from '../../dto/response/quiz-response-docs.dto';

@ApiTags('quizzes')
@Controller('quizzes')
@UseFilters(QuizDomainExceptionFilter)
export class QuizController {
  constructor(
    private readonly quizApplicationService: QuizApplicationService,
    private readonly quizVersionApplicationService: QuizVersionApplicationService,
    private readonly quizQuestionApplicationService: QuizQuestionApplicationService,
  ) {}

  @Post()
  @Permissions(Permission.QUIZ_CREATE)
  @ApiAuthCreate({ description: 'Quiz created', type: WrappedQuizResponseDto })
  @ApiForbiddenResponse({ description: 'You do not have permission to create quizzes' })
  createQuiz(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizDto,
  ): Promise<QuizResponseDto> {
    return this.quizApplicationService.createQuiz(user, payload);
  }

  @Get()
  @Public()
  @ApiPublicList({ description: 'Quizzes returned', type: WrappedQuizListDto })
  listQuizzes(@Query() query: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    return this.quizApplicationService.listQuizzes(query);
  }

  @Get('me')
  @ApiAuthList({ description: 'Quizzes returned', type: WrappedQuizListDto })
  listMyQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    return this.quizApplicationService.listMyQuizzes(userId, query);
  }

  @Get('me/drafts')
  @ApiAuthList({ description: 'Draft quizzes returned', type: WrappedQuizListDto })
  listMyDraftQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    return this.quizApplicationService.listMyDraftQuizzes(userId, query);
  }

  @Get('me/published')
  @ApiAuthList({ description: 'Published quizzes returned', type: WrappedQuizListDto })
  listMyPublishedQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    return this.quizApplicationService.listMyPublishedQuizzes(userId, query);
  }

  @Get('trending')
  @Public()
  @ApiPublicList({ description: 'Trending quizzes returned', type: WrappedTrendingQuizzesDto })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of trending quizzes to return (1–100)',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category UUID',
    schema: { type: 'string', format: 'uuid' },
  })
  getTrendingQuizzes(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('categoryId') categoryId?: string,
  ): Promise<TrendingQuizzesResponseDto> {
    return this.quizApplicationService.getTrendingQuizzes(limit, categoryId);
  }

  @Get('popular')
  @Public()
  @ApiPublicList({ description: 'Popular quizzes returned', type: WrappedPopularQuizzesDto })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of popular quizzes to return (1–100)',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category UUID',
    schema: { type: 'string', format: 'uuid' },
  })
  getPopularQuizzes(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('categoryId') categoryId?: string,
  ): Promise<PopularQuizzesResponseDto> {
    return this.quizApplicationService.getPopularQuizzes(limit, categoryId);
  }

  @Get('me/analytics')
  @ApiAuthList({ description: 'Quiz analytics returned', type: WrappedCreatorAnalyticsDto })
  getMyQuizAnalytics(@CurrentUser('sub') userId: string): Promise<CreatorQuizAnalyticsDto> {
    return this.quizApplicationService.getMyQuizAnalytics(userId);
  }

  @Get('featured')
  @Public()
  @ApiPublicList({ description: 'Featured quizzes returned', type: WrappedRelatedQuizzesDto })
  getFeaturedQuizzes(@Query() query: FeaturedQuizzesQueryDto): Promise<RelatedQuizzesResponseDto> {
    return this.quizApplicationService.getFeaturedQuizzes(query);
  }

  @Get(':id')
  @Public()
  @ApiPublicList({ description: 'Quiz found', type: WrappedQuizResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  getQuizById(@Param('id', new ParseUUIDPipe()) quizId: string): Promise<QuizResponseDto> {
    return this.quizApplicationService.getQuizById(quizId);
  }

  @Get(':id/stats')
  @Public()
  @ApiPublicList({ description: 'Quiz stats returned', type: WrappedQuizStatsDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  getQuizStats(@Param('id', new ParseUUIDPipe()) quizId: string): Promise<QuizStatsResponseDto> {
    return this.quizApplicationService.getQuizStats(quizId);
  }

  @Get(':slug/similar')
  @Public()
  @ApiPublicList({ description: 'Related quizzes returned', type: WrappedRelatedQuizzesDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for cursor-based pagination',
    schema: { type: 'string', maxLength: 512 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of related quizzes to return (1–100)',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
  })
  async getRelatedQuizzes(
    @Param('slug') slug: string,
    @Query() query: RelatedQuizzesQueryDto,
  ): Promise<RelatedQuizzesResponseDto> {
    const relatedQuizzesQuery = {
      limit: query.limit ?? 10,
    };

    const response = await this.quizApplicationService.getRelatedQuizzes(slug, relatedQuizzesQuery);

    return response;
  }

  @Get(':slug')
  @Public()
  @ApiPublicList({ description: 'Quiz found', type: WrappedQuizResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  getQuizBySlug(@Param('slug') slug: string): Promise<QuizResponseDto> {
    return this.quizApplicationService.getQuizBySlug(slug);
  }

  @Patch(':id')
  @Permissions(Permission.QUIZ_EDIT_OWN, Permission.QUIZ_EDIT_ANY)
  @ApiAuthUpdateWithState({ description: 'Quiz updated', type: WrappedQuizResponseDto })
  updateQuiz(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateQuizDto,
  ): Promise<QuizResponseDto> {
    return this.quizApplicationService.updateQuiz(quizId, user, payload);
  }

  @Delete(':id')
  @Permissions(Permission.QUIZ_DELETE_OWN, Permission.QUIZ_DELETE_ANY)
  @ApiAuth()
  @ApiOperation({
    summary: 'Delete quiz',
    description:
      'Soft-deletes a quiz by ID. Requires `quiz:delete:own` or `quiz:delete:any` permission.',
  })
  @ApiOkResponse({ description: 'Quiz deleted', type: WrappedMessageDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to delete this quiz' })
  @ApiInternalServerErrorResponse()
  deleteQuiz(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteQuizResponseDto> {
    return this.quizApplicationService.deleteQuiz(quizId, user);
  }

  @Post(':id/versions')
  @Permissions(Permission.QUIZ_VERSION_CREATE_OWN, Permission.QUIZ_VERSION_CREATE_ANY)
  @ApiAuthCreate({ description: 'Quiz version created', type: WrappedQuizVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiForbiddenResponse({
    description: 'You do not have permission to create versions for this quiz',
  })
  createQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    return this.quizVersionApplicationService.createQuizVersion(quizId, user, payload);
  }

  @Get(':id/versions')
  @Permissions(Permission.QUIZ_VERSION_VIEW_OWN, Permission.QUIZ_VERSION_VIEW_ANY)
  @ApiAuthList({ description: 'Versions returned', type: WrappedQuizVersionListDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to view versions of this quiz' })
  listQuizVersions(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListQuizVersionsQueryDto,
  ): Promise<QuizVersionListResponseDto> {
    return this.quizVersionApplicationService.listQuizVersions(quizId, user, query);
  }

  @Get(':id/versions/:versionId')
  @Permissions(Permission.QUIZ_VERSION_VIEW_OWN, Permission.QUIZ_VERSION_VIEW_ANY)
  @ApiAuthList({ description: 'Quiz version returned', type: WrappedQuizVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to view this version' })
  getQuizVersionDetail(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @Param('versionId', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuizVersionDetailResponseDto> {
    return this.quizVersionApplicationService.getQuizVersionDetail(quizId, quizVersionId, user);
  }

  @Patch(':id/versions/:versionId')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  @ApiAuthUpdateWithState({ description: 'Version updated', type: WrappedQuizVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to edit this version' })
  updateQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @Param('versionId', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    return this.quizVersionApplicationService.updateQuizVersion(
      quizId,
      quizVersionId,
      user,
      payload,
    );
  }

  @Post(':id/versions/:versionId/publish')
  @Permissions(Permission.QUIZ_VERSION_PUBLISH_OWN, Permission.QUIZ_VERSION_PUBLISH_ANY)
  @ApiAuth()
  @ApiOperation({
    summary: 'Publish quiz version',
    description: `Publishes a draft quiz version, making it available for attempts. Only one version per quiz can be published at a time. The version must contain at least ${5} questions. Requires \`quiz-version:publish:own\` or \`quiz-version:publish:any\`.`,
  })
  @ApiOkResponse({ description: 'Version published', type: WrappedQuizVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to publish this quiz version' })
  @ApiConflict()
  @ApiUnprocessableEntityResponse({
    description: 'Quiz version does not meet requirements (e.g., insufficient questions)',
  })
  @ApiInternalServerErrorResponse()
  publishQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @Param('versionId', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuizVersionResponseDto> {
    return this.quizVersionApplicationService.publishQuizVersion(quizId, quizVersionId, user);
  }

  @Post(':id/versions/:versionId/questions')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  @ApiAuthCreate({ description: 'Question created', type: WrappedQuizQuestionDto })
  @ApiNotFoundResponse({ description: 'Quiz or version not found' })
  @ApiForbiddenResponse({
    description: 'You do not have permission to add questions to this version',
  })
  createQuizQuestion(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @Param('versionId', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizQuestionDto,
  ): Promise<QuizQuestionResponseDto> {
    return this.quizQuestionApplicationService.createQuizQuestion(
      quizId,
      quizVersionId,
      user,
      payload,
    );
  }

  @Post(':id/versions/:versionId/questions/bulk')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  @ApiAuthCreate({ description: 'Questions created', type: WrappedQuizQuestionArrayDto })
  @ApiNotFoundResponse({ description: 'Quiz or version not found' })
  @ApiForbiddenResponse({
    description: 'You do not have permission to add questions to this version',
  })
  createQuizQuestions(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @Param('versionId', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizQuestionsDto,
  ): Promise<QuizQuestionResponseDto[]> {
    return this.quizQuestionApplicationService.createQuizQuestions(
      quizId,
      quizVersionId,
      user,
      payload,
    );
  }
}
