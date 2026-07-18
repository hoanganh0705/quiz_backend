import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserBadgeItemDto {
  @ApiProperty({
    description: 'Badge identifier',
    example: 'b9d6f3a0-7d6e-7d6c-b4d2-1a4f6b2aef90',
  })
  badgeId!: string;

  @ApiProperty({ description: 'Badge name', example: 'Quiz Master' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Badge description',
    type: String,
    nullable: true,
    example: 'Earned by completing 100 quizzes with a score above 90%.',
  })
  description!: string | null;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the user earned this badge',
    example: '2026-05-12T14:18:00.000Z',
  })
  earnedAt!: string;
}

export class UserBadgesPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 10 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page (base64-encoded)',
    type: String,
    nullable: true,
    example: 'eyJlYXJuZWRBdCI6IjIwMjYtMDEtMDFUMDA6MDA6MDBaIiwidXNlckJhZGdlSWQiOiJ1dWlkIn0=',
  })
  nextCursor!: string | null;
}

export class UserBadgesResponseDto {
  @ApiProperty({
    description: 'Badge items for the current page',
    type: () => [UserBadgeItemDto],
  })
  items!: UserBadgeItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserBadgesPaginationDto })
  pagination!: UserBadgesPaginationDto;
}
