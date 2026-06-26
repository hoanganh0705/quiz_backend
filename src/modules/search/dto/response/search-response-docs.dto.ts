import { ApiProperty } from '@nestjs/swagger';
import { SearchResponseDto } from './search-response.dto';

// ─── Search module documentation-only wrapper DTOs ─────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// Runtime DTOs (SearchResponseDto, SearchUserResultDto, etc.) live in
// search-response.dto.ts and are imported here for use in wrapper type refs.
//
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse
// decorators to document the actual wrapped shape in the OpenAPI spec.
//

class MetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

export class WrappedSearchResponseDto {
  @ApiProperty({
    description:
      'Aggregated full-text search results across users, quizzes, and discussion threads',
    type: () => SearchResponseDto,
  })
  data!: SearchResponseDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}
