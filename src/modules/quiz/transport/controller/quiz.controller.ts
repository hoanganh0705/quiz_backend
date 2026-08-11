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
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiQuery,
  ApiOperation,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  ApiExtraModels,
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
import { QuizPreviewResponseDto } from '../../dto/response/quiz-preview-response.dto';
import { QuizStatsHistoryResponseDto } from '../../dto/response/quiz-stats-history-response.dto';
import { QuizAggregateResponseDto } from '../../dto/response/quiz-aggregate-response.dto';
import { QuizStatsHistoryQueryDto } from '../../dto/request/quiz-stats-history-query.dto';
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
import { QuizQuestionAuthorDto } from '@/modules/quiz/dto/response/quiz-question-author.dto';
import { QuizAnswerOptionAuthorDto } from '@/modules/quiz/dto/response/quiz-answer-option-author.dto';
import { QuizAnswerOptionPlayerDto } from '@/modules/quiz/dto/response/quiz-answer-option-player.dto';
import { QuizQuestionPlayerDto } from '@/modules/quiz/dto/response/quiz-question-player.dto';
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
  @ApiOperation({ summary: 'Create a new quiz' })
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
  @ApiOperation({ summary: 'List all public quizzes' })
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
  @ApiOperation({ summary: 'List quizzes created by the authenticated user' })
  @ApiOkResourceList(QuizListItemDto, 'cursor', { description: 'Quizzes returned' })
  @ApiUnauthorizedResponse({ example: meQuizzesUnauthorizedExample })
  @ApiForbiddenResponse({ example: meQuizzesForbiddenExample })
  @ApiInternalServerErrorResponse({ example: meQuizzesInternalErrorExample })
  async listMyQuizzes(@CurrentUser('sub') userId: string, @Query() query: ListQuizzesQueryDto) {
    const result = await this.quizApplicationService.listMyQuizzes(userId, query);
    return this.presenter.listMyQuizzes(result);
  }

  @Get('me/drafts')
  @ApiOperation({ summary: "List the authenticated user's draft quizzes" })
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
  @ApiOperation({ summary: "List the authenticated user's published quizzes" })
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
  @ApiOperation({ summary: 'List trending quizzes' })
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
  @ApiOperation({ summary: 'List popular quizzes' })
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
  @ApiOperation({ summary: "Get analytics for the authenticated user's quizzes" })
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
  @ApiOperation({
    summary: 'List featured quizzes',
    description:
      'Returns editorially curated featured quizzes. ' +
      'Results are limited (max 100) with no cursor pagination — ' +
      'featured quizzes are a static editorial set, not a browsable feed.',
  })
  @ApiOkResourceArray(QuizListItemDto, {
    description: 'Featured quizzes returned (no pagination — fixed editorial set)',
  })
  @ApiBadRequestResponse({ example: featuredBadRequestExample })
  @ApiInternalServerErrorResponse({ example: featuredInternalErrorExample })
  async getFeaturedQuizzes(@Query() query: FeaturedQuizzesQueryDto) {
    const result = await this.quizApplicationService.getFeaturedQuizzes(query);
    return this.presenter.getFeaturedQuizzes(result);
  }

  @Get(':id')
  @Public()
  @ApiExtraModels(QuizQuestionPlayerDto, QuizAnswerOptionPlayerDto)
  @ApiOperation({
    summary: 'Get quiz by ID or slug',
    description:
      'Returns the quiz and, when one is published, its published version. ' +
      'For player-facing access (this public endpoint), the published version ' +
      'includes questions but the `isCorrect` flag is stripped from each answer ' +
      'option to prevent spoilers — correct answers are revealed only after the ' +
      'user finishes an attempt, via GET /attempts/{attemptId}/review.',
  })
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
  @ApiOperation({ summary: 'Get quiz statistics' })
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
  async getQuizStats(@Param('id', new ParseUUIDOrSlugPipe()) quizIdOrSlug: string) {
    const result = await this.quizApplicationService.getQuizStats(
      isUuid(quizIdOrSlug) ? quizIdOrSlug : undefined,
      quizIdOrSlug,
    );
    return this.presenter.getQuizStats(result);
  }

  /**
   * Phase 2 (S-11): bucket-level attempt timeline. Used by the
   * stats panel's longer-range chart. Supports `?range=7d|30d` and
   * `?bucket=day|hour`. Defaults to `30d`/`day`.
   */
  @Get(':id/stats/history')
  @Public()
  @ApiOperation({
    summary: 'Get quiz stats history (sparkline)',
    description:
      'Returns a densified attempt timeline for the quiz. Supports `?range=7d|30d` ' +
      'and `?bucket=day|hour`. Gaps in the timeline are filled with zeros so the client ' +
      'can render a continuous chart without further math.',
  })
  @ApiOkResource(QuizStatsHistoryResponseDto, {
    description: 'Bucketed stats timeline returned',
  })
  @ApiBadRequestResponse({
    description: 'Path param must be a UUID or a kebab-case slug',
    example: quizStatsBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz not found',
    example: quizStatsNotFoundExample,
  })
  @ApiInternalServerErrorResponse({ example: quizStatsInternalErrorExample })
  async getQuizStatsHistory(
    @Param('id', new ParseUUIDOrSlugPipe()) quizIdOrSlug: string,
    @Query() query: QuizStatsHistoryQueryDto,
  ) {
    const result = await this.quizApplicationService.getQuizStatsHistory(
      isUuid(quizIdOrSlug) ? quizIdOrSlug : undefined,
      quizIdOrSlug,
      query,
    );
    return this.presenter.getQuizStatsHistory(result);
  }

  /**
   * Phase 2 (S-9): public preview of a quiz. Returns the first
   * `previewSize` questions of the published version with the
   * `isCorrect` flag stripped — players can scroll through a
   * representative slice before deciding whether to start an
   * attempt. The auth check on this route is `@Public()` so
   * deep-link previews work from social / share surfaces.
   *
   * The number of questions is server-controlled; today it is
   * hard-coded to 2 (see `PREVIEW_QUESTION_COUNT`).
   */
  @Get(':id/preview')
  @Public()
  @ApiOperation({
    summary: 'Get a public preview of a quiz',
    description:
      'Returns the first `previewSize` questions of the published version with the ' +
      '`isCorrect` flag stripped from each answer option. Use this for social / share ' +
      'previews — players should not see correct answers before they start an attempt.',
  })
  @ApiOkResource(QuizPreviewResponseDto, { description: 'Quiz preview returned' })
  @ApiBadRequestResponse({
    description: 'Path param must be a UUID or a kebab-case slug',
    example: quizByIdBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz not found',
    example: quizByIdNotFoundExample,
  })
  @ApiInternalServerErrorResponse({ example: quizByIdInternalErrorExample })
  async getQuizPreview(@Param('id', new ParseUUIDOrSlugPipe()) quizIdOrSlug: string) {
    const result = await this.quizApplicationService.getQuizPreview(quizIdOrSlug);
    return this.presenter.getQuizPreview(result);
  }

  /**
   * Phase 4 (S-24): quiz aggregate bundle. Replaces the 5+ sequential
   * calls the quiz detail page used to issue (quiz, stats, history,
   * preview, etc.) with a single parallelised fan-out.
   */
  @Get(':id/aggregate')
  @Public()
  @ApiOperation({
    summary: 'Get the quiz aggregate bundle',
    description:
      'Returns the bundled payload for the quiz detail page: quiz, stats, ' +
      'stats history, and a player-style preview of the first N questions. ' +
      'The endpoint is public (no auth required).',
  })
  @ApiOkResource(QuizAggregateResponseDto, {
    description: 'Quiz aggregate bundle returned',
  })
  @ApiBadRequestResponse({
    description: 'Path param must be a UUID or a kebab-case slug',
    example: quizByIdBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz not found',
    example: quizByIdNotFoundExample,
  })
  @ApiInternalServerErrorResponse({ example: quizByIdInternalErrorExample })
  async getQuizAggregate(@Param('id', new ParseUUIDOrSlugPipe()) quizIdOrSlug: string) {
    const result = await this.quizApplicationService.getQuizAggregate(quizIdOrSlug);
    return this.presenter.getQuizAggregate(result);
  }

  /**
   * Get quizzes related to the specified quiz.
   *
   * The `:slug` path parameter accepts a kebab-case quiz slug (e.g., "javascript-fundamentals").
   * Related quizzes are determined by shared category and tags with the source quiz.
   * Returns quizzes sorted by relevance score, limited by the `limit` query parameter.
   */
  @Get(':slug/related')
  @Public()
  @ApiOperation({
    summary: 'Get quizzes related to the specified quiz',
    description:
      'Returns quizzes that share a category or tags with the source quiz, ' +
      'sorted by relevance. Results are limited (max 100) with no cursor pagination — ' +
      'this is a discovery hint, not a browsable feed.',
  })
  @ApiOkResourceArray(QuizListItemDto, {
    description: 'Related quizzes returned (no pagination — relevance-ranked discovery set)',
  })
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
    return this.presenter.getRelatedQuizzes(result);
  }

  @Patch(':id')
  @Permissions(Permission.QUIZ_EDIT_OWN, Permission.QUIZ_EDIT_ANY)
  @ApiOperation({ summary: 'Update a quiz' })
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
  @ApiOperation({ summary: 'Delete a quiz' })
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
  @ApiOperation({ summary: 'Create a new draft version for a quiz' })
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
  @ApiOperation({ summary: 'List all versions of a quiz' })
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
  @ApiExtraModels(QuizQuestionAuthorDto, QuizAnswerOptionAuthorDto)
  @ApiOperation({ summary: 'Get a specific quiz version' })
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
  @ApiOperation({ summary: 'Update a quiz version' })
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
  @ApiOperation({ summary: 'Publish a quiz version' })
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
  // Phase 5 (S-27): cap question creation at 30/min/user. Authors
  // who legitimately need more should batch via the /bulk endpoint
  // (which is itself capped at 50 questions per request).
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Add a question to a quiz version' })
  @ApiCreatedResource(QuizQuestionAuthorDto, { description: 'Question created' })
  @ApiBadRequestResponse({
    description: 'Path params must be UUIDs or request body failed validation',
    example: createQuizQuestionBadRequestExample,
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Per-field validation failed; ProblemDetail `extensions.validationErrors` ' +
      'carries the array of `{ field, message }` rows so the editor can surface ' +
      'inline errors per input.',
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
  // Phase 5 (S-28): cap bulk calls at 10/min/user. Each call may
  // carry up to 50 questions, so this effectively caps new questions
  // at 500/min/user — well above any legitimate editor pace.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Add multiple questions to a quiz version in bulk' })
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
