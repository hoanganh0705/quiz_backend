import { Controller, Get, Param, ParseUUIDPipe, Query, UseFilters } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { DiscussionApplicationService } from '@/modules/discussion/application/discussion-application.service';
import { ListQuizDiscussionsQueryDto } from '@/modules/discussion/dto/request';
import { QuizDiscussionListResponseDto } from '@/modules/discussion/dto/response';
import { WrappedQuizDiscussionsDto } from '@/modules/discussion/dto/response/discussion-response-docs.dto';
import { QuizDiscussionCursorMapper } from '@/modules/discussion/mappers/quiz-discussion-cursor.mapper';
import { DiscussionDomainExceptionFilter } from '../filters/discussion-domain-exception.filter';

@ApiTags('quizzes')
@Controller('quizzes')
@UseFilters(DiscussionDomainExceptionFilter)
export class QuizDiscussionController {
  constructor(private readonly discussionApplicationService: DiscussionApplicationService) {}

  @Get(':quizId/discussions')
  @Public()
  @ApiOperation({
    summary: 'List quiz discussions',
    description: 'Returns a paginated list of discussion threads for a specific quiz.',
  })
  @ApiOkResponse({
    description: 'Discussion threads returned',
    type: WrappedQuizDiscussionsDto,
  })
  async listQuizDiscussions(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @Query() query: ListQuizDiscussionsQueryDto,
  ): Promise<QuizDiscussionListResponseDto> {
    return this.discussionApplicationService.listQuizDiscussions(quizId, {
      limit: query.limit ?? 20,
      cursor: query.cursor ? QuizDiscussionCursorMapper.parse(query.cursor) : null,
    });
  }
}
