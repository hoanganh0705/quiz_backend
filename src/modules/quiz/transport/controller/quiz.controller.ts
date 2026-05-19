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
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizApplicationService } from '../../application/quiz.application.service';
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

@Controller('quizzes')
@UseFilters(QuizDomainExceptionFilter)
export class QuizController {
  constructor(private readonly quizApplicationService: QuizApplicationService) {}

  @Post()
  @Permissions(Permission.QUIZ_CREATE)
  createQuiz(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizDto,
  ): Promise<QuizResponseDto> {
    return this.quizApplicationService.createQuiz(user, payload);
  }

  @Get()
  @Public()
  listQuizzes(@Query() query: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    return this.quizApplicationService.listQuizzes(query);
  }

  @Get(':slug')
  @Public()
  getQuizBySlug(@Param('slug') slug: string): Promise<QuizResponseDto> {
    return this.quizApplicationService.getQuizBySlug(slug);
  }

  @Patch(':id')
  updateQuiz(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateQuizDto,
  ): Promise<QuizResponseDto> {
    return this.quizApplicationService.updateQuiz(quizId, user, payload);
  }

  @Delete(':id')
  deleteQuiz(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteQuizResponseDto> {
    return this.quizApplicationService.deleteQuiz(quizId, user);
  }

  @Post(':id/versions')
  @Permissions(Permission.QUIZ_VERSION_CREATE_OWN, Permission.QUIZ_VERSION_CREATE_ANY)
  createQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    return this.quizApplicationService.createQuizVersion(quizId, user, payload);
  }

  @Get(':id/versions')
  @Permissions(Permission.QUIZ_VERSION_VIEW_OWN, Permission.QUIZ_VERSION_VIEW_ANY)
  listQuizVersions(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListQuizVersionsQueryDto,
  ): Promise<QuizVersionListResponseDto> {
    return this.quizApplicationService.listQuizVersions(quizId, user, query);
  }

  @Post(':id/versions/:versionId/questions')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  createQuizQuestion(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @Param('versionId', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizQuestionDto,
  ): Promise<QuizQuestionResponseDto> {
    return this.quizApplicationService.createQuizQuestion(quizId, quizVersionId, user, payload);
  }

  @Post(':id/versions/:versionId/questions/bulk')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  createQuizQuestions(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @Param('versionId', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizQuestionsDto,
  ): Promise<QuizQuestionResponseDto[]> {
    return this.quizApplicationService.createQuizQuestions(quizId, quizVersionId, user, payload);
  }
}
