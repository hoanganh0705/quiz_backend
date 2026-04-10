import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateQuizDto } from './dto/request/create-quiz.dto';
import { QuizVersionResponseDto } from './dto/response/quiz-version-response.dto';
import { QuizService } from './quiz.service';
import { QuizResponseDto } from './dto/response/quiz-response.dto';
import { QuizListResponseDto } from './dto/response/quiz-list-response.dto';
import { ListQuizzesQueryDto } from './dto/request/list-quizzes-query.dto';
import { CreateQuizVersionDto } from './dto/request/create-quiz-version.dto';
import { ListQuizVersionsQueryDto } from './dto/request/list-quiz-versions-query.dto';
import { QuizVersionListResponseDto } from './dto/response/quiz-version-list-response.dto';
@Controller('quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('creator')
  createQuiz(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizDto,
  ): Promise<QuizResponseDto> {
    return this.quizService.createQuiz(user, payload);
  }

  @Get()
  @Public()
  listQuizzes(@Query() query: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    return this.quizService.listQuizzes(query);
  }

  @Get(':slug')
  @Public()
  getQuizBySlug(@Param('slug') slug: string): Promise<QuizResponseDto> {
    return this.quizService.getQuizBySlug(slug);
  }

  @Post(':id/versions')
  @UseGuards(RolesGuard)
  @Roles('creator', 'admin')
  createQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    return this.quizService.createQuizVersion(quizId, user, payload);
  }

  @Get(':id/versions')
  @UseGuards(RolesGuard)
  @Roles('creator', 'admin')
  listQuizVersions(
    @Param('id', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListQuizVersionsQueryDto,
  ): Promise<QuizVersionListResponseDto> {
    return this.quizService.listQuizVersions(quizId, user, query);
  }
}
