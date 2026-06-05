import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserActivityItemDto } from './user-activity-item.dto';

class UserActivityPaginationDto {
  @ApiProperty()
  limit!: number;

  @ApiProperty()
  hasNextPage!: boolean;

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null;
}

export class UserActivityResponseDto {
  @ApiProperty({ type: [UserActivityItemDto] })
  items!: UserActivityItemDto[];

  @ApiProperty({ type: UserActivityPaginationDto })
  pagination!: UserActivityPaginationDto;
}
