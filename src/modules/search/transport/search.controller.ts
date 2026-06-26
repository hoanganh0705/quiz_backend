import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ApiPublicRead } from '@/common/swagger/swagger-decorators';
import { SearchApplicationService } from '../application/search.application.service';
import { SearchQueryDto, WrappedSearchResponseDto } from '../dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchApplicationService: SearchApplicationService) {}

  @Get()
  @Public()
  @ApiPublicRead({
    description:
      'Aggregated full-text search results across users, quizzes, and discussion threads',
    type: WrappedSearchResponseDto,
  })
  getSearchResults(@Query() query: SearchQueryDto) {
    return this.searchApplicationService.search(query.q, query.limit);
  }
}
