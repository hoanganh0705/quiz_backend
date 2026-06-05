import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserBadgeItemDto } from './user-badge-item.dto';

class UserBadgesPaginationDto {
  @ApiProperty()
  limit!: number;

  @ApiProperty()
  hasNextPage!: boolean;

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null;
}

export class UserBadgesResponseDto {
  @ApiProperty({ type: [UserBadgeItemDto] })
  items!: UserBadgeItemDto[];

  @ApiProperty({ type: UserBadgesPaginationDto })
  pagination!: UserBadgesPaginationDto;
}
