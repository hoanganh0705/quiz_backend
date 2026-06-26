import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { QuizDifficulty } from '@/modules/quiz/types/quiz.types';
import type { QuizInstanceStatus } from '../../types/instance.types';
import { INSTANCE_STATUSES } from '../request/instance.dto';
import { InstancePlayerResponseDto } from './instance-player-response.dto';

export class InstanceDetailResponseDto {
  @ApiProperty({
    description: 'Unique instance identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Quiz version hosted in this instance',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiProperty({
    description: 'Host user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
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

  @ApiProperty({ description: 'Quiz version number', example: 1 })
  versionNumber!: number;

  @ApiProperty({
    description: 'Quiz difficulty',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  difficulty!: QuizDifficulty;

  @ApiProperty({ description: 'Time limit in milliseconds', example: 600_000 })
  durationMs!: number;

  @ApiProperty({ description: 'Passing score percent', example: 70 })
  passingScorePercent!: number;

  @ApiProperty({ description: 'XP reward for completing', example: 100 })
  rewardXp!: number;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440099',
  })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  quizSlug!: string;

  @ApiProperty({
    description: 'Instance creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Start timestamp (ISO 8601)',
    type: String,
    example: '2025-06-01T12:05:00.000Z',
    nullable: true,
  })
  startedAt!: string | null;

  @ApiPropertyOptional({
    description: 'Close timestamp (ISO 8601)',
    type: String,
    example: '2025-06-01T12:30:00.000Z',
    nullable: true,
  })
  closedAt!: string | null;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Players currently in the instance',
    type: () => [InstancePlayerResponseDto],
  })
  players!: InstancePlayerResponseDto[];
}
