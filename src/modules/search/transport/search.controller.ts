import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import { SearchApplicationService } from '../application/search.application.service';
import { SearchQueryDto } from '../dto/search-query.dto';
import { SearchResponseDto } from '../dto/search-response.dto';

@ApiTags('Search')
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
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getSearchResults(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    return this.searchApplicationService.search(query.q, query.limit);
  }
}
