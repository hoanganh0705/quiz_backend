import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QUIZ_DIFFICULTIES, type QuizDifficulty } from '@/modules/quiz/types/quiz.types';

export class CreateInstanceDto {
  @ApiProperty({
    description:
      'UUID of the quiz to host. The latest published version of the quiz is resolved server-side.',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440099',
  })
  @IsUUID('7')
  quizId!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of players (2–100, defaults to unlimited)',
    minimum: 2,
    maximum: 100,
    default: null,
    example: 10,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  maxPlayers?: number;
}

export const INSTANCE_STATUSES = ['open', 'countdown', 'running', 'closed', 'finished'] as const;
export type InstanceStatus = (typeof INSTANCE_STATUSES)[number];

export class GetLeaderboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Opaque cursor for cursor-based pagination. Decode base64url to JSON `{ rank, instancePlayerId }`. ' +
      'Pass the `nextCursor` from the previous page response to continue pagination.',
    nullable: true,
    example:
      'eyJyYW5rIjogMjQsICJpbnN0YW5jZVBsYXllcklkIjogIjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA5OSJ9',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of entries to return per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Phase 6 (api-contract audit) — query DTO for `GET /instances/{id}/players`.
 * Mirrors `GetLeaderboardQueryDto` so the players endpoint can use the
 * canonical cursor-paginated envelope `{ data: InstancePlayer[], meta: { timestamp, pagination } }`.
 *
 * The cursor encodes `(joinedAt, instancePlayerId)` since the players list
 * is sorted by join time. Use `decodeInstancePlayerCursor` in the
 * controller to validate the cursor before passing it to the application
 * service.
 */
export class GetInstancePlayersQueryDto {
  @ApiPropertyOptional({
    description:
      'Opaque cursor for cursor-based pagination. Decode base64url to JSON `{ joinedAt, instancePlayerId }`. ' +
      'Pass the `nextCursor` from the previous page response to continue pagination.',
    nullable: true,
    example:
      'eyJqb2luZWRBdCI6IjIwMjYtMDYtMjVUMTA6MzA6MDAuMDAwWiIsImluc3RhbmNlUGxheWVySWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwOTkifQ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of players to return per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ListInstancesQueryDto {
  @ApiPropertyOptional({
    // Phase 4 (audit issue 2.9): aligned with the rest of the codebase
    // (the shared `encodeBase64JsonCursor` utility emits base64url, as
    // does the leaderboard cursor). The previous docstring called this
    // "Decode base64" which misled SDK generators that round-trip via
    // base64url.
    description:
      'Opaque cursor for cursor-based pagination. Decode base64url to JSON `{ createdAt, instanceId }`. ' +
      'Pass the `nextCursor` from the previous page response to continue pagination.',
    nullable: true,
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTI1VDEwOjMwOjAwLjAwMFoiLCJpbnN0YW5jZUlkIjoiNjYwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of instances to return per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by instance status',
    enum: INSTANCE_STATUSES,
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsIn(INSTANCE_STATUSES)
  status?: InstanceStatus;

  @ApiPropertyOptional({
    description: 'Filter by quiz difficulty',
    enum: QUIZ_DIFFICULTIES,
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsIn(QUIZ_DIFFICULTIES)
  difficulty?: QuizDifficulty;

  @ApiPropertyOptional({
    description: 'Filter by quiz UUID',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  quizId?: string;

  @ApiPropertyOptional({
    description: 'Filter by host/creator UUID',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  creatorId?: string;
}
