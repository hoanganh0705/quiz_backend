import { ApiProperty } from '@nestjs/swagger';

export class ThreadParticipantItemResponseDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Username of the participant',
    example: 'Anh',
  })
  username!: string;

  @ApiProperty({
    description: 'Number of comments posted by the participant in the thread',
    example: 12,
  })
  commentCount!: number;
}

export class ThreadParticipantsResponseDto {
  @ApiProperty({
    description: 'Thread participants ordered by comment count descending',
    type: () => [ThreadParticipantItemResponseDto],
  })
  items!: ThreadParticipantItemResponseDto[];
}
