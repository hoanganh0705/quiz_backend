import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiParam, ApiOperation } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { DiscussionApplicationService } from '@/modules/discussion/application/discussion-application.service';
import { ListQuizDiscussionsQueryDto } from '@/modules/discussion/dto/request';
import { QuizDiscussionItemResponseDto } from '@/modules/discussion/dto/response';
import { ApiOkResourceList } from '@/common/swagger/api-ok';
import { DiscussionPresenter } from '../presenters/discussion.presenter';
import { QuizDiscussionCursorMapper } from '@/modules/discussion/mappers/quiz-discussion-cursor.mapper';

// All error responses (404 from `DISCUSSION_QUIZ_NOT_FOUND`) are routed
// through `GlobalExceptionFilter` as RFC 7807 `ProblemDetailDto` after
// Phase 3.1. The per-module filter has been removed.

@ApiTags('quizzes')
@Controller('quizzes')
export class QuizDiscussionController {
  constructor(
    private readonly discussionApplicationService: DiscussionApplicationService,
    private readonly presenter: DiscussionPresenter,
  ) {}

  @Get(':quizId/discussions')
  @Public()
  @ApiOperation({ summary: 'List discussion threads for a quiz' })
  @ApiOkResourceList(QuizDiscussionItemResponseDto, 'cursor', {
    description: 'Discussion threads returned',
  })
  @ApiParam({ name: 'quizId', format: 'uuid' })
  async listQuizDiscussions(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @Query() query: ListQuizDiscussionsQueryDto,
  ) {
    const result = await this.discussionApplicationService.listQuizDiscussions(quizId, {
      limit: query.limit ?? 20,
      cursor: query.cursor ? QuizDiscussionCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listQuizDiscussions(result);
  }
}
