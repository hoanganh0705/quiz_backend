import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
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
import { ListQuizzesQueryDto } from '../../dto/request/list-quizzes-query.dto';
import { UpdateQuizDto } from '@/modules/quiz/dto/request/update-quiz.dto';
import { DeleteQuizResponseDto } from '@/modules/quiz/dto/response/delete-quiz-response.dto';
import { CreateQuizVersionDto } from '../../dto/request/create-quiz-version.dto';
import { ListQuizVersionsQueryDto } from '../../dto/request/list-quiz-versions-query.dto';
import { QuizVersionListResponseDto } from '../../dto/response/quiz-version-list-response.dto';
import { QuizVersionResponseDto } from '../../dto/response/quiz-version-response.dto';
import { CreateQuizQuestionDto } from '@/modules/quiz/dto/request/create-quiz-question.dto';
import { CreateQuizQuestionsDto } from '@/modules/quiz/dto/request/create-quiz-questions.dto';
import { QuizQuestionResponseDto } from '@/modules/quiz/dto/response/quiz-question-response.dto';
import { QuizDomainExceptionFilter } from '../filters/quiz-domain-exception.filter';

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
