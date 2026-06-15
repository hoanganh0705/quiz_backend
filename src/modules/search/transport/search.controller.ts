import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ApiPublicList } from '@/common/swagger/swagger-decorators';
import { SearchApplicationService } from '../application/search.application.service';
import { SearchQueryDto } from '../dto/search-query.dto';
import { SearchResponseDto } from '../dto/search-response.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchApplicationService: SearchApplicationService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Global full-text search',
    description:
      'Searches users, quizzes, and discussion threads with PostgreSQL full text search and returns ranked results for each section.',
  })
  @ApiOkResponse({
    description: 'Aggregated search results returned',
    type: SearchResponseDto,
  })
  @ApiPublicList()
  getSearchResults(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    return this.searchApplicationService.search(query.q, query.limit);
  }
}
