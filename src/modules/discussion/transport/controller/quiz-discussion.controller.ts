import { Controller, Get, Param, ParseUUIDPipe, Query, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { DiscussionApplicationService } from '@/modules/discussion/application/discussion-application.service';
import { ListQuizDiscussionsQueryDto } from '@/modules/discussion/dto/request';
import { QuizDiscussionItemResponseDto } from '@/modules/discussion/dto/response';
import { ApiOkResourceList } from '@/common/swagger/api-ok';
import { DiscussionPresenter } from '../presenters/discussion.presenter';
import { QuizDiscussionCursorMapper } from '@/modules/discussion/mappers/quiz-discussion-cursor.mapper';
import { DiscussionDomainExceptionFilter } from '../filters/discussion-domain-exception.filter';

@ApiTags('quizzes')
@Controller('quizzes')
@UseFilters(DiscussionDomainExceptionFilter)
export class QuizDiscussionController {
  constructor(
    private readonly discussionApplicationService: DiscussionApplicationService,
    private readonly presenter: DiscussionPresenter,
  ) {}

  @Get(':quizId/discussions')
  @Public()
  @ApiOkResourceList(QuizDiscussionItemResponseDto, 'cursor', {
    description: 'Discussion threads returned',
  })
  async listQuizDiscussions(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @Query() query: ListQuizDiscussionsQueryDto,
  ) {
    const result = await this.discussionApplicationService.listQuizDiscussions(quizId, {
      limit: query.limit ?? 20,
      cursor: query.cursor ? QuizDiscussionCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listQuizDiscussions(result);
  }
}
