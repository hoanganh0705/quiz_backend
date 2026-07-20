import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ApiOkResource } from '@/common/swagger/api-ok';
import { SearchApplicationService } from '../application/search.application.service';
import { SearchQueryDto, SearchResponseDto } from '../dto';
import { SearchPresenter } from './search.presenter';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchApplicationService: SearchApplicationService,
    private readonly presenter: SearchPresenter,
  ) {}

  @Get()
  @Public()
  @ApiOkResource(SearchResponseDto, {
    description:
      'Aggregated full-text search results across users, quizzes, discussion threads, categories, and tags',
  })
  async getSearchResults(@Query() query: SearchQueryDto) {
    const result = await this.searchApplicationService.search(query.q, query.limit);
    return this.presenter.search(result);
  }
}
