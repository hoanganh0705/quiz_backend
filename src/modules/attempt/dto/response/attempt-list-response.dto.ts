import { ApiProperty } from '@nestjs/swagger';
import { AttemptSummaryResponseDto } from './attempt-summary-response.dto';

export class AttemptPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({
    description: 'Cursor for next page',
    type: String,
    nullable: true,
    example:
      'eyJzb3J0VmFsdWUiOiIyMDI1LTA2LTAxVDEyOjQ1OjAwLjAwMFoiLCJhdHRlbXB0SWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwOTkifQ==',
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Has more pages', example: true })
  hasNextPage!: boolean;
}

export class AttemptListResponseDto {
  @ApiProperty({
    description: 'Attempt summaries',
    type: [AttemptSummaryResponseDto],
  })
  items!: AttemptSummaryResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: AttemptPaginationResponseDto,
  })
  pagination!: AttemptPaginationResponseDto;
}
