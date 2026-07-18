import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { QuizDifficulty } from '@/modules/quiz/types/quiz.types';
import { INSTANCE_STATUSES, type QuizInstanceStatus } from '../../types/instance.types';

export class InstanceListItemDto {
  @ApiProperty({
    description: 'Instance identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Quiz version identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiProperty({
    description: 'Host user identifier',
    example: '770e8400-e29b-71d4-a716-446655440000',
  })
  hostUserId!: string;

  @ApiProperty({ description: 'Host username', example: 'alice_wonder' })
  hostUsername!: string;

  @ApiPropertyOptional({
    description: 'Host display name',
    type: String,
    example: 'Alice Wonder',
    nullable: true,
  })
  hostDisplayName!: string | null;

  @ApiPropertyOptional({
    description: 'Maximum player capacity (null = unlimited)',
    type: Number,
    example: 10,
    nullable: true,
  })
  maxPlayers!: number | null;

  @ApiProperty({
    description: 'Instance lifecycle status',
    enum: INSTANCE_STATUSES,
    example: 'open',
  })
  status!: QuizInstanceStatus;

  @ApiProperty({
    description: 'Quiz difficulty',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  difficulty!: QuizDifficulty;

  @ApiProperty({ description: 'Time limit in milliseconds', example: 600_000 })
  durationMs!: number;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-71d4-a716-446655440099',
  })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  quizSlug!: string;

  @ApiProperty({
    description: 'Number of players currently in the instance',
    example: 5,
  })
  playerCount!: number;

  @ApiProperty({
    description: 'Instance creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;
}

export class InstanceListPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description: 'Cursor for next page',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Has more pages', example: true })
  hasNextPage!: boolean;
}

export class InstanceListResponseDto {
  @ApiProperty({ description: 'Instance items', type: () => [InstanceListItemDto] })
  items!: InstanceListItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => InstanceListPaginationDto })
  pagination!: InstanceListPaginationDto;
}
