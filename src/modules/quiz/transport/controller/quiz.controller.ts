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
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
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
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Create quiz',
    description: 'Creates a new quiz with an initial version. Requires `quiz:create` permission.',
  })
  @ApiCreatedResponse({ description: 'Quiz created', type: QuizResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Quiz with this slug already exists' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  createQuiz(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizDto,
  ): Promise<QuizResponseDto> {
    return this.quizApplicationService.createQuiz(user, payload);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List quizzes',
    description:
      'Returns a paginated, cursor-based list of quizzes. Supports filtering by difficulty, category, and tag.',
  })
  @ApiOkResponse({ description: 'Quizzes returned', type: QuizListResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listQuizzes(@Query() query: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    return this.quizApplicationService.listQuizzes(query);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'List my quizzes',
    description:
      'Returns a paginated, cursor-based list of quizzes created by the authenticated user, ordered by newest first.',
  })
  @ApiOkResponse({ description: 'Quizzes returned', type: QuizListResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    return this.quizApplicationService.listMyQuizzes(userId, query);
  }

  @Get('me/drafts')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'List my draft quizzes',
    description:
      'Returns a paginated, cursor-based list of draft quizzes owned by the authenticated user, ordered by newest first.',
  })
  @ApiOkResponse({ description: 'Draft quizzes returned', type: QuizListResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyDraftQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    return this.quizApplicationService.listMyDraftQuizzes(userId, query);
  }

  @Get('me/published')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'List my published quizzes',
    description:
      'Returns a paginated, cursor-based list of published quizzes owned by the authenticated user, ordered by newest first.',
  })
  @ApiOkResponse({ description: 'Published quizzes returned', type: QuizListResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  listMyPublishedQuizzes(
    @CurrentUser('sub') userId: string,
    @Query() query: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    return this.quizApplicationService.listMyPublishedQuizzes(userId, query);
  }

  @Get('trending')
  @Public()
  @ApiOperation({
    summary: 'Trending quizzes',
    description:
      'Returns published quizzes ranked by recent engagement using the existing weekly trending calculation.',
  })
  @ApiOkResponse({ description: 'Trending quizzes returned', type: TrendingQuizzesResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getTrendingQuizzes(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('categoryId') categoryId?: string,
  ): Promise<TrendingQuizzesResponseDto> {
    return this.quizApplicationService.getTrendingQuizzes(limit, categoryId);
  }

  @Get('popular')
  @Public()
  @ApiOperation({
    summary: 'Popular quizzes',
    description:
      'Returns published quizzes ranked by the existing popularity score combining attempts, ratings, and bookmarks.',
  })
  @ApiOkResponse({ description: 'Popular quizzes returned', type: PopularQuizzesResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getPopularQuizzes(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('categoryId') categoryId?: string,
  ): Promise<PopularQuizzesResponseDto> {
    return this.quizApplicationService.getPopularQuizzes(limit, categoryId);
  }

  @Get('me/analytics')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my quiz analytics',
    description:
      'Returns creator-level analytics aggregated across all quizzes owned by the authenticated user.',
  })
  @ApiOkResponse({ description: 'Quiz analytics returned', type: CreatorQuizAnalyticsDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getMyQuizAnalytics(@CurrentUser('sub') userId: string): Promise<CreatorQuizAnalyticsDto> {
    return this.quizApplicationService.getMyQuizAnalytics(userId);
  }

  @Get('featured')
  @Public()
  @ApiOperation({
    summary: 'Featured quizzes',
    description:
      'Returns active, published featured quizzes ordered by most recently featured first.',
  })
  @ApiOkResponse({ description: 'Featured quizzes returned', type: RelatedQuizzesResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getFeaturedQuizzes(@Query() query: FeaturedQuizzesQueryDto): Promise<RelatedQuizzesResponseDto> {
    return this.quizApplicationService.getFeaturedQuizzes(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get quiz by ID',
    description: 'Returns a single quiz by its unique ID including the published version summary.',
  })
  @ApiOkResponse({ description: 'Quiz found', type: QuizResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getQuizById(@Param('id', new ParseUUIDPipe()) quizId: string): Promise<QuizResponseDto> {
    return this.quizApplicationService.getQuizById(quizId);
  }

  @Get(':id/stats')
  @Public()
  @ApiOperation({
    summary: 'Quiz stats',
    description: 'Returns aggregated statistics for a quiz.',
  })
  @ApiOkResponse({ description: 'Quiz stats returned', type: QuizStatsResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getQuizStats(@Param('id', new ParseUUIDPipe()) quizId: string): Promise<QuizStatsResponseDto> {
    return this.quizApplicationService.getQuizStats(quizId);
  }

  @Get(':slug/similar')
  @Public()
  @ApiOperation({
    summary: 'Similar quizzes',
    description:
      'Returns related quizzes ranked by shared categories, shared tags, and popularity.',
  })
  @ApiOkResponse({ description: 'Related quizzes returned', type: RelatedQuizzesResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
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
  @ApiOperation({
    summary: 'Get quiz by slug',
    description: 'Returns a single quiz by its URL slug including the published version summary.',
  })
  @ApiOkResponse({ description: 'Quiz found', type: QuizResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getQuizBySlug(@Param('slug') slug: string): Promise<QuizResponseDto> {
    return this.quizApplicationService.getQuizBySlug(slug);
  }

  @Patch(':id')
  @Permissions(Permission.QUIZ_EDIT_OWN, Permission.QUIZ_EDIT_ANY)
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Update quiz',
    description: 'Updates a quiz by ID. Requires `quiz:edit:own` or `quiz:edit:any` permission.',
  })
  @ApiOkResponse({ description: 'Quiz updated', type: QuizResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to edit this quiz' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Quiz with this slug already exists' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  updateQuiz(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateQuizDto,
  ): Promise<QuizResponseDto> {
    return this.quizApplicationService.updateQuiz(quizId, user, payload);
  }

  @Delete(':id')
  @Permissions(Permission.QUIZ_DELETE_OWN, Permission.QUIZ_DELETE_ANY)
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Delete quiz',
    description:
      'Soft-deletes a quiz by ID. Requires `quiz:delete:own` or `quiz:delete:any` permission.',
  })
  @ApiOkResponse({ description: 'Quiz deleted', type: DeleteQuizResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to delete this quiz' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  deleteQuiz(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteQuizResponseDto> {
    return this.quizApplicationService.deleteQuiz(quizId, user);
  }

  @Post(':id/versions')
  @Permissions(Permission.QUIZ_VERSION_CREATE_OWN, Permission.QUIZ_VERSION_CREATE_ANY)
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Create quiz version',
    description:
      'Creates a new draft version for a quiz. Optionally copies questions from an existing version. Requires `quiz-version:create:own` or `quiz-version:create:any`.',
  })
  @ApiCreatedResponse({ description: 'Quiz version created', type: QuizVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiForbiddenResponse({
    description: 'You do not have permission to create versions for this quiz',
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  createQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    return this.quizVersionApplicationService.createQuizVersion(quizId, user, payload);
  }

  @Get(':id/versions')
  @Permissions(Permission.QUIZ_VERSION_VIEW_OWN, Permission.QUIZ_VERSION_VIEW_ANY)
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'List quiz versions',
    description:
      'Returns all versions of a quiz. Requires `quiz-version:view:own` or `quiz-version:view:any`.',
  })
  @ApiOkResponse({ description: 'Versions returned', type: QuizVersionListResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to view versions of this quiz' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listQuizVersions(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListQuizVersionsQueryDto,
  ): Promise<QuizVersionListResponseDto> {
    return this.quizVersionApplicationService.listQuizVersions(quizId, user, query);
  }

  @Get(':id/versions/:versionId')
  @Permissions(Permission.QUIZ_VERSION_VIEW_OWN, Permission.QUIZ_VERSION_VIEW_ANY)
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Get quiz version detail',
    description:
      'Returns complete details of a single quiz version. Requires `quiz-version:view:own` or `quiz-version:view:any`.',
  })
  @ApiOkResponse({ description: 'Quiz version returned', type: QuizVersionDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to view this quiz version' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getQuizVersionDetail(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @Param('versionId', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuizVersionDetailResponseDto> {
    return this.quizVersionApplicationService.getQuizVersionDetail(quizId, quizVersionId, user);
  }

  @Patch(':id/versions/:versionId')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Update quiz version',
    description:
      "Updates a quiz version's metadata (difficulty, duration, passing score, XP reward). Requires `quiz-version:edit:own` or `quiz-version:edit:any`.",
  })
  @ApiOkResponse({ description: 'Version updated', type: QuizVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to edit this quiz version' })
  @ApiBadRequestResponse({ description: 'Validation failed or quiz version is not editable' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
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
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Publish quiz version',
    description: `Publishes a draft quiz version, making it available for attempts. Only one version per quiz can be published at a time. The version must contain at least ${5} questions. Requires \`quiz-version:publish:own\` or \`quiz-version:publish:any\`.`,
  })
  @ApiOkResponse({ description: 'Version published', type: QuizVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to publish this quiz version' })
  @ApiBadRequestResponse({ description: 'Validation failed or quiz version is not publishable' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  publishQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @Param('versionId', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuizVersionResponseDto> {
    return this.quizVersionApplicationService.publishQuizVersion(quizId, quizVersionId, user);
  }

  @Post(':id/versions/:versionId/questions')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Create question',
    description:
      'Adds a single question to a quiz version. Requires `quiz-version:edit:own` or `quiz-version:edit:any`.',
  })
  @ApiCreatedResponse({ description: 'Question created', type: QuizQuestionResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to edit this quiz version' })
  @ApiBadRequestResponse({ description: 'Validation failed or quiz version is not editable' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
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
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Create questions in bulk',
    description:
      'Adds multiple questions to a quiz version in a single request. Requires `quiz-version:edit:own` or `quiz-version:edit:any`.',
  })
  @ApiCreatedResponse({ description: 'Questions created', type: [QuizQuestionResponseDto] })
  @ApiNotFoundResponse({ description: 'Quiz or version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to edit this quiz version' })
  @ApiBadRequestResponse({ description: 'Validation failed or quiz version is not editable' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
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
