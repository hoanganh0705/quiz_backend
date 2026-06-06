import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import { DiscussionApplicationService } from '@/modules/discussion/application/discussion-application.service';
import { ListQuizDiscussionsQueryDto } from '@/modules/discussion/dto/request';
import { QuizDiscussionListResponseDto } from '@/modules/discussion/dto/response';
import { QuizDiscussionCursorMapper } from '@/modules/discussion/mappers/quiz-discussion-cursor.mapper';
import { DiscussionDomainExceptionFilter } from './filters/discussion-domain-exception.filter';

@ApiTags('quizzes')
@ApiBearerAuth()
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
  @ApiOkResponse({ description: 'Discussion threads returned', type: QuizDiscussionListResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
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
