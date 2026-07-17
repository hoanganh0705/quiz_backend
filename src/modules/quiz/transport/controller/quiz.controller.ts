import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiQuery,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import {
  ApiOkResource,
  ApiOkResourceArray,
  ApiOkResourceList,
  ApiCreatedResource,
} from '@/common/swagger/api-ok';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ParseUUIDOrSlugPipe, isUuid } from '@/common/pipes/parse-uuid-or-slug.pipe';
import { QuizApplicationService } from '../../application/quiz.application.service';
import { QuizVersionApplicationService } from '../../application/quiz-version.application.service';
import { QuizQuestionApplicationService } from '../../application/quiz-question.application.service';
import { CreateQuizDto } from '../../dto/request/create-quiz.dto';
import { QuizResponseDto } from '../../dto/response/quiz-response.dto';
import { QuizListItemDto } from '../../dto/response/quiz-list-item.dto';
import {
  CreatorQuizAnalyticsDto,
  PopularQuizItemDto,
  TrendingQuizItemDto,
} from '../../dto/response/quiz-analytics.dto';
import { BulkQuizQuestionsResponseDto } from '../../dto/response/bulk-quiz-questions-response.dto';
import { QuizStatsResponseDto } from '../../dto/response/quiz-stats-response.dto';
import { FeaturedQuizzesQueryDto } from '../../dto/request/featured-quizzes-query.dto';
import { RelatedQuizzesQueryDto } from '../../dto/request/related-quizzes-query.dto';
import { ListQuizzesQueryDto } from '../../dto/request/list-quizzes-query.dto';
import { UpdateQuizDto } from '@/modules/quiz/dto/request/update-quiz.dto';
import { DeleteQuizResponseDto } from '@/modules/quiz/dto/response/delete-quiz-response.dto';
import { CreateQuizVersionDto } from '../../dto/request/create-quiz-version.dto';
import { UpdateQuizVersionDto } from '../../dto/request/update-quiz-version.dto';
import { ListQuizVersionsQueryDto } from '../../dto/request/list-quiz-versions-query.dto';
import { CreateQuizQuestionDto } from '@/modules/quiz/dto/request/create-quiz-question.dto';
import { CreateQuizQuestionsDto } from '@/modules/quiz/dto/request/create-quiz-questions.dto';
import { QuizQuestionResponseDto } from '@/modules/quiz/dto/response/quiz-question-response.dto';
import {
  QuizVersionDetailResponseDto,
  QuizVersionResponseDto,
} from '../../dto/response/quiz-version-response.dto';
import { QuizPresenter } from '../presenters/quiz.presenter';
import {
  createQuizBadRequestExample,
  createQuizConflictExample,
  createQuizForbiddenExample,
  createQuizUnauthorizedExample,
  createQuizInternalErrorExample,
  quizByIdBadRequestExample,
  quizByIdNotFoundExample,
  quizByIdInternalErrorExample,
  quizStatsBadRequestExample,
  quizStatsNotFoundExample,
  quizStatsInternalErrorExample,
  relatedQuizzesBadRequestExample,
  relatedQuizzesNotFoundExample,
  relatedQuizzesInternalErrorExample,
  trendingBadRequestExample,
  trendingInternalErrorExample,
  popularBadRequestExample,
  popularInternalErrorExample,
  featuredBadRequestExample,
  featuredInternalErrorExample,
  listQuizzesBadRequestExample,
  listQuizzesInternalErrorExample,
  meQuizzesInternalErrorExample,
  meQuizzesForbiddenExample,
  meQuizzesUnauthorizedExample,
  meDraftsInternalErrorExample,
  meDraftsForbiddenExample,
  meDraftsUnauthorizedExample,
  mePublishedInternalErrorExample,
  mePublishedForbiddenExample,
  mePublishedUnauthorizedExample,
  meAnalyticsInternalErrorExample,
  meAnalyticsForbiddenExample,
  meAnalyticsUnauthorizedExample,
  updateQuizBadRequestExample,
  updateQuizNotFoundExample,
  updateQuizConflictExample,
  updateQuizForbiddenExample,
  updateQuizUnauthorizedExample,
  updateQuizInternalErrorExample,
  deleteQuizNotFoundExample,
  deleteQuizForbiddenExample,
  deleteQuizUnauthorizedExample,
  deleteQuizInternalErrorExample,
  createQuizVersionBadRequestExample,
  createQuizVersionNotFoundExample,
  createQuizVersionForbiddenExample,
  createQuizVersionUnauthorizedExample,
  createQuizVersionInternalErrorExample,
  createQuizVersionConflictExample,
  listQuizVersionsNotFoundExample,
  listQuizVersionsForbiddenExample,
  listQuizVersionsUnauthorizedExample,
  listQuizVersionsInternalErrorExample,
  getQuizVersionDetailBadRequestExample,
  getQuizVersionDetailNotFoundExample,
  getQuizVersionDetailForbiddenExample,
  getQuizVersionDetailUnauthorizedExample,
  getQuizVersionDetailInternalErrorExample,
  updateQuizVersionBadRequestExample,
  updateQuizVersionNotFoundExample,
  updateQuizVersionConflictExample,
  updateQuizVersionForbiddenExample,
  updateQuizVersionUnauthorizedExample,
  updateQuizVersionInternalErrorExample,
  publishQuizVersionBadRequestExample,
  publishQuizVersionNotFoundExample,
  publishQuizVersionForbiddenExample,
  publishQuizVersionUnauthorizedExample,
  publishQuizVersionUnprocessableExample,
  publishQuizVersionInternalErrorExample,
  createQuizQuestionBadRequestExample,
  createQuizQuestionConflictExample,
  createQuizQuestionNotFoundExample,
  createQuizQuestionForbiddenExample,
  createQuizQuestionUnauthorizedExample,
  createQuizQuestionInternalErrorExample,
  createQuizQuestionsBadRequestExample,
  createQuizQuestionsConflictExample,
  createQuizQuestionsNotFoundExample,
  createQuizQuestionsForbiddenExample,
  createQuizQuestionsUnauthorizedExample,
  createQuizQuestionsInternalErrorExample,
} from '../swagger/examples/errors.examples';

/**
 * Quiz module API controller.
 *
 * ## Rate Limiting
 * Public read endpoints (`GET /quizzes`, `GET /quizzes/:id`, etc.) are rate-limited
 * to 100 requests per minute per IP. Authenticated endpoints allow 1000 requests
 * per minute per user. Write operations (`POST`, `PATCH`, `DELETE`) are limited to
 * 100 requests per minute per user.
 */
@ApiTags('quizzes')
@Controller('quizzes')
export class QuizController {
  constructor(
    private readonly quizApplicationService: QuizApplicationService,
    private readonly quizVersionApplicationService: QuizVersionApplicationService,
    private readonly quizQuestionApplicationService: QuizQuestionApplicationService,
    private readonly presenter: QuizPresenter,
  ) {}

  @Post()
  @Permissions(Permission.QUIZ_CREATE)
  @ApiCreatedResource(QuizResponseDto, { description: 'Quiz created' })
  @ApiBadRequestResponse({
    description: 'Request body validation failed',
    example: createQuizBadRequestExample,
  })
  @ApiConflictResponse({
    description: 'A quiz with this slug already exists',
    example: createQuizConflictExample,
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to create quizzes',
    example: createQuizForbiddenExample,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    example: createQuizUnauthorizedExample,
  })
  @ApiInternalServerErrorResponse({ example: createQuizInternalErrorExample })
  async createQuiz(@CurrentUser() user: JwtPayload, @Body() payload: CreateQuizDto) {
    const quiz = await this.quizApplicationService.createQuiz(user, payload);
    return this.presenter.createQuiz(quiz);
  }

  @Get()
  @Public()
  @ApiOkResourceList(QuizListItemDto, 'cursor', { description: 'Quizzes returned' })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    example: listQuizzesBadRequestExample,
  })
  @ApiInternalServerErrorResponse({ example: listQuizzesInternalErrorExample })
  async listQuizzes(@Query() query: ListQuizzesQueryDto) {
    const result = await this.quizApplicationService.listQuizzes(query);
    return this.presenter.listQuizzes(result);
  }

  @Get('me')
  @ApiOkResourceList(QuizListItemDto, 'cursor', { description: 'Quizzes returned' })
  @ApiUnauthorizedResponse({ example: meQuizzesUnauthorizedExample })
  @ApiForbiddenResponse({ example: meQuizzesForbiddenExample })
  @ApiInternalServerErrorResponse({ example: meQuizzesInternalErrorExample })
  async listMyQuizzes(@CurrentUser('sub') userId: string, @Query() query: ListQuizzesQueryDto) {
    const result = await this.quizApplicationService.listMyQuizzes(userId, query);
    return this.presenter.listMyQuizzes(result);
  }

  @Get('me/drafts')
  @ApiOkResourceList(QuizListItemDto, 'cursor', { description: 'Draft quizzes returned' })
  @ApiUnauthorizedResponse({ example: meDraftsUnauthorizedExample })
  @ApiForbiddenResponse({ example: meDraftsForbiddenExample })
  @ApiInternalServerErrorResponse({ example: meDraftsInternalErrorExample })
  async listMyDraftQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ) {
    const result = await this.quizApplicationService.listMyDraftQuizzes(userId, query);
    return this.presenter.listMyDraftQuizzes(result);
  }

  @Get('me/published')
  @ApiOkResourceList(QuizListItemDto, 'cursor', { description: 'Published quizzes returned' })
  @ApiUnauthorizedResponse({ example: mePublishedUnauthorizedExample })
  @ApiForbiddenResponse({ example: mePublishedForbiddenExample })
  @ApiInternalServerErrorResponse({ example: mePublishedInternalErrorExample })
  async listMyPublishedQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ) {
    const result = await this.quizApplicationService.listMyPublishedQuizzes(userId, query);
    return this.presenter.listMyPublishedQuizzes(result);
  }

  @Get('trending')
  @Public()
  @ApiOkResourceArray(TrendingQuizItemDto, { description: 'Trending quizzes returned' })
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
  @ApiBadRequestResponse({ example: trendingBadRequestExample })
  @ApiInternalServerErrorResponse({ example: trendingInternalErrorExample })
  async getTrendingQuizzes(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('categoryId') categoryId?: string,
  ) {
    const result = await this.quizApplicationService.getTrendingQuizzes(limit, categoryId);
    return this.presenter.getTrendingQuizzes(result);
  }

  @Get('popular')
  @Public()
  @ApiOkResourceArray(PopularQuizItemDto, { description: 'Popular quizzes returned' })
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
  @ApiBadRequestResponse({ example: popularBadRequestExample })
  @ApiInternalServerErrorResponse({ example: popularInternalErrorExample })
  async getPopularQuizzes(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('categoryId') categoryId?: string,
  ) {
    const result = await this.quizApplicationService.getPopularQuizzes(limit, categoryId);
    return this.presenter.getPopularQuizzes(result);
  }

  @Get('me/analytics')
  @ApiOkResource(CreatorQuizAnalyticsDto, { description: 'Quiz analytics returned' })
  @ApiUnauthorizedResponse({ example: meAnalyticsUnauthorizedExample })
  @ApiForbiddenResponse({ example: meAnalyticsForbiddenExample })
  @ApiInternalServerErrorResponse({ example: meAnalyticsInternalErrorExample })
  async getMyQuizAnalytics(@CurrentUser('sub') userId: string) {
    const result = await this.quizApplicationService.getMyQuizAnalytics(userId);
    return this.presenter.getMyQuizAnalytics(result);
  }

  @Get('featured')
  @Public()
  @ApiOkResourceArray(QuizListItemDto, { description: 'Featured quizzes returned' })
  @ApiBadRequestResponse({ example: featuredBadRequestExample })
  @ApiInternalServerErrorResponse({ example: featuredInternalErrorExample })
  async getFeaturedQuizzes(@Query() query: FeaturedQuizzesQueryDto) {
    const result = await this.quizApplicationService.getFeaturedQuizzes(query);
    return this.presenter.getFeaturedQuizzes(result);
  }

  @Get(':id')
  @Public()
  @ApiOkResource(QuizResponseDto, { description: 'Quiz found' })
  @ApiBadRequestResponse({
    description: 'Path param must be a UUID or slug',
    example: quizByIdBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz not found',
    example: quizByIdNotFoundExample,
  })
  @ApiInternalServerErrorResponse({ example: quizByIdInternalErrorExample })
  async getQuizById(@Param('id', new ParseUUIDOrSlugPipe()) idOrSlug: string) {
    const quiz = isUuid(idOrSlug)
      ? await this.quizApplicationService.getQuizById(idOrSlug)
      : await this.quizApplicationService.getQuizBySlug(idOrSlug);
    return this.presenter.getQuiz(quiz);
  }

  @Get(':id/stats')
  @Public()
  @ApiOkResource(QuizStatsResponseDto, { description: 'Quiz stats returned' })
  @ApiBadRequestResponse({
    description: 'Path param must be a UUID or a kebab-case slug',
    example: quizStatsBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz not found',
    example: quizStatsNotFoundExample,
  })
  @ApiInternalServerErrorResponse({ example: quizStatsInternalErrorExample })
  async getQuizStats(@Param('id', new ParseUUIDOrSlugPipe()) quizId: string) {
    const result = await this.quizApplicationService.getQuizStats(
      isUuid(quizId) ? quizId : undefined,
      quizId,
    );
    return this.presenter.getQuizStats(result);
  }

  /**
   * Get quizzes similar to the specified quiz.
   *
   * The `:slug` path parameter accepts a kebab-case quiz slug (e.g., "javascript-fundamentals").
   * Related quizzes are determined by shared category and tags with the source quiz.
   * Returns quizzes sorted by relevance score, limited by the `limit` query parameter.
   */
  @Get(':slug/similar')
  @Public()
  @ApiOkResourceArray(QuizListItemDto, { description: 'Related quizzes returned' })
  @ApiNotFoundResponse({
    description: 'Quiz not found',
    example: relatedQuizzesNotFoundExample,
  })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    example: relatedQuizzesBadRequestExample,
  })
  @ApiInternalServerErrorResponse({ example: relatedQuizzesInternalErrorExample })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of related quizzes to return (1–100)',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
  })
  async getRelatedQuizzes(@Param('slug') slug: string, @Query() query: RelatedQuizzesQueryDto) {
    const result = await this.quizApplicationService.getRelatedQuizzes(slug, {
      limit: query.limit ?? 10,
    });
    return this.presenter.getSimilarQuizzes(result);
  }

  @Patch(':id')
  @Permissions(Permission.QUIZ_EDIT_OWN, Permission.QUIZ_EDIT_ANY)
  @ApiOkResource(QuizResponseDto, { description: 'Quiz updated' })
  @ApiBadRequestResponse({
    description: 'Path param must be a UUID or request body failed validation',
    example: updateQuizBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz not found',
    example: updateQuizNotFoundExample,
  })
  @ApiConflictResponse({
    description: 'A quiz with this slug already exists',
    example: updateQuizConflictExample,
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to edit this quiz',
    example: updateQuizForbiddenExample,
  })
  @ApiUnauthorizedResponse({ example: updateQuizUnauthorizedExample })
  @ApiInternalServerErrorResponse({ example: updateQuizInternalErrorExample })
  async updateQuiz(
    @Param('id', new ParseUUIDOrSlugPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateQuizDto,
  ) {
    const quiz = await this.quizApplicationService.updateQuiz(quizId, user, payload);
    return this.presenter.updateQuiz(quiz);
  }

  @Delete(':id')
  @Permissions(Permission.QUIZ_DELETE_OWN, Permission.QUIZ_DELETE_ANY)
  @ApiOkResource(DeleteQuizResponseDto, { description: 'Quiz deleted' })
  @ApiNotFoundResponse({
    description: 'Quiz not found',
    example: deleteQuizNotFoundExample,
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to delete this quiz',
    example: deleteQuizForbiddenExample,
  })
  @ApiUnauthorizedResponse({ example: deleteQuizUnauthorizedExample })
  @ApiBadRequestResponse({
    description: 'Path param must be a UUID',
    example: quizByIdBadRequestExample,
  })
  @ApiInternalServerErrorResponse({ example: deleteQuizInternalErrorExample })
  async deleteQuiz(
    @Param('id', new ParseUUIDOrSlugPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.quizApplicationService.deleteQuiz(quizId, user);
    return this.presenter.deleteQuiz(result);
  }

  @Post(':id/versions')
  @Permissions(Permission.QUIZ_VERSION_CREATE_OWN, Permission.QUIZ_VERSION_CREATE_ANY)
  @ApiCreatedResource(QuizVersionResponseDto, { description: 'Quiz version created' })
  @ApiBadRequestResponse({
    description: 'Path param must be a UUID or request body failed validation',
    example: createQuizVersionBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz or source version not found',
    example: createQuizVersionNotFoundExample,
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to create versions for this quiz',
    example: createQuizVersionForbiddenExample,
  })
  @ApiUnauthorizedResponse({ example: createQuizVersionUnauthorizedExample })
  @ApiConflictResponse({
    description: 'Source version is not in a state that can be used as a draft base',
    example: createQuizVersionConflictExample,
  })
  @ApiInternalServerErrorResponse({ example: createQuizVersionInternalErrorExample })
  async createQuizVersion(
    @Param('id', new ParseUUIDOrSlugPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizVersionDto,
  ) {
    const result = await this.quizVersionApplicationService.createQuizVersion(
      quizId,
      user,
      payload,
    );
    return this.presenter.createQuizVersion(result);
  }

  @Get(':id/versions')
  @Permissions(Permission.QUIZ_VERSION_VIEW_OWN, Permission.QUIZ_VERSION_VIEW_ANY)
  @ApiOkResourceList(QuizVersionResponseDto, 'cursor', { description: 'Versions returned' })
  @ApiNotFoundResponse({
    description: 'Quiz not found',
    example: listQuizVersionsNotFoundExample,
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to view versions of this quiz',
    example: listQuizVersionsForbiddenExample,
  })
  @ApiUnauthorizedResponse({ example: listQuizVersionsUnauthorizedExample })
  @ApiBadRequestResponse({
    description: 'Path param must be a UUID',
    example: quizByIdBadRequestExample,
  })
  @ApiInternalServerErrorResponse({ example: listQuizVersionsInternalErrorExample })
  async listQuizVersions(
    @Param('id', new ParseUUIDOrSlugPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListQuizVersionsQueryDto,
  ) {
    const result = await this.quizVersionApplicationService.listQuizVersions(quizId, user, query);
    return this.presenter.listQuizVersions(result);
  }

  @Get(':id/versions/:versionId')
  @Permissions(Permission.QUIZ_VERSION_VIEW_OWN, Permission.QUIZ_VERSION_VIEW_ANY)
  @ApiOkResource(QuizVersionDetailResponseDto, { description: 'Quiz version returned' })
  @ApiBadRequestResponse({
    description: 'Path params must be UUIDs',
    example: getQuizVersionDetailBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz or version not found',
    example: getQuizVersionDetailNotFoundExample,
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to view this version',
    example: getQuizVersionDetailForbiddenExample,
  })
  @ApiUnauthorizedResponse({ example: getQuizVersionDetailUnauthorizedExample })
  @ApiInternalServerErrorResponse({ example: getQuizVersionDetailInternalErrorExample })
  async getQuizVersionDetail(
    @Param('id', new ParseUUIDOrSlugPipe()) quizId: string,
    @Param('versionId', new ParseUUIDOrSlugPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.quizVersionApplicationService.getQuizVersionDetail(
      quizId,
      quizVersionId,
      user,
    );
    return this.presenter.getQuizVersionDetail(result);
  }

  @Patch(':id/versions/:versionId')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  @ApiOkResource(QuizVersionResponseDto, { description: 'Version updated' })
  @ApiBadRequestResponse({
    description: 'Path params must be UUIDs or request body failed validation',
    example: updateQuizVersionBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz or version not found',
    example: updateQuizVersionNotFoundExample,
  })
  @ApiConflictResponse({
    description: 'Version is not in a state that can be edited',
    example: updateQuizVersionConflictExample,
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to edit this version',
    example: updateQuizVersionForbiddenExample,
  })
  @ApiUnauthorizedResponse({ example: updateQuizVersionUnauthorizedExample })
  @ApiInternalServerErrorResponse({ example: updateQuizVersionInternalErrorExample })
  async updateQuizVersion(
    @Param('id', new ParseUUIDOrSlugPipe()) quizId: string,
    @Param('versionId', new ParseUUIDOrSlugPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateQuizVersionDto,
  ) {
    const result = await this.quizVersionApplicationService.updateQuizVersion(
      quizId,
      quizVersionId,
      user,
      payload,
    );
    return this.presenter.updateQuizVersion(result);
  }

  @Post(':id/versions/:versionId/publish')
  @Permissions(Permission.QUIZ_VERSION_PUBLISH_OWN, Permission.QUIZ_VERSION_PUBLISH_ANY)
  @ApiOkResource(QuizVersionResponseDto, { description: 'Version published' })
  @ApiBadRequestResponse({
    description: 'Version is not in draft state, or path params are not UUIDs',
    example: publishQuizVersionBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz or version not found',
    example: publishQuizVersionNotFoundExample,
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to publish this quiz version',
    example: publishQuizVersionForbiddenExample,
  })
  @ApiUnauthorizedResponse({ example: publishQuizVersionUnauthorizedExample })
  @ApiUnprocessableEntityResponse({
    description: 'Quiz version does not meet requirements (e.g., insufficient questions)',
    example: publishQuizVersionUnprocessableExample,
  })
  @ApiInternalServerErrorResponse({ example: publishQuizVersionInternalErrorExample })
  async publishQuizVersion(
    @Param('id', new ParseUUIDOrSlugPipe()) quizId: string,
    @Param('versionId', new ParseUUIDOrSlugPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.quizVersionApplicationService.publishQuizVersion(
      quizId,
      quizVersionId,
      user,
    );
    return this.presenter.publishQuizVersion(result);
  }

  @Post(':id/versions/:versionId/questions')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  @ApiCreatedResource(QuizQuestionResponseDto, { description: 'Question created' })
  @ApiBadRequestResponse({
    description: 'Path params must be UUIDs or request body failed validation',
    example: createQuizQuestionBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz or version not found',
    example: createQuizQuestionNotFoundExample,
  })
  @ApiConflictResponse({
    description: 'A question or answer option with this position already exists',
    example: createQuizQuestionConflictExample,
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to add questions to this version',
    example: createQuizQuestionForbiddenExample,
  })
  @ApiUnauthorizedResponse({ example: createQuizQuestionUnauthorizedExample })
  @ApiInternalServerErrorResponse({ example: createQuizQuestionInternalErrorExample })
  async createQuizQuestion(
    @Param('id', new ParseUUIDOrSlugPipe()) quizId: string,
    @Param('versionId', new ParseUUIDOrSlugPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizQuestionDto,
  ) {
    const result = await this.quizQuestionApplicationService.createQuizQuestion(
      quizId,
      quizVersionId,
      user,
      payload,
    );
    return this.presenter.createQuizQuestion(result);
  }

  @Post(':id/versions/:versionId/questions/bulk')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  @ApiCreatedResource(BulkQuizQuestionsResponseDto, { description: 'Questions created' })
  @ApiBadRequestResponse({
    description: 'Path params must be UUIDs or request body failed validation',
    example: createQuizQuestionsBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz or version not found',
    example: createQuizQuestionsNotFoundExample,
  })
  @ApiConflictResponse({
    description:
      'A question or answer option with this position already exists in one or more items',
    example: createQuizQuestionsConflictExample,
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to add questions to this version',
    example: createQuizQuestionsForbiddenExample,
  })
  @ApiUnauthorizedResponse({ example: createQuizQuestionsUnauthorizedExample })
  @ApiInternalServerErrorResponse({ example: createQuizQuestionsInternalErrorExample })
  async createQuizQuestions(
    @Param('id', new ParseUUIDOrSlugPipe()) quizId: string,
    @Param('versionId', new ParseUUIDOrSlugPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizQuestionsDto,
  ) {
    const result = await this.quizQuestionApplicationService.createQuizQuestions(
      quizId,
      quizVersionId,
      user,
      payload,
    );
    return this.presenter.createQuizQuestions(result);
  }
}
