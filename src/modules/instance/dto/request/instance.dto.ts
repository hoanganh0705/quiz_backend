import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QUIZ_DIFFICULTIES } from '@/modules/quiz/types/quiz.types';

export class CreateInstanceDto {
  @ApiProperty({
    description: 'UUID of the published quiz version to host',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  quizVersionId!: string;

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

export const INSTANCE_STATUSES = ['open', 'running', 'closed', 'finished'] as const;
export type InstanceStatus = (typeof INSTANCE_STATUSES)[number];

export class GetLeaderboardQueryDto {
  @ApiPropertyOptional({
    description: 'Base64-encoded cursor for cursor-based pagination',
    nullable: true,
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

export class ListInstancesQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    nullable: true,
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
    nullable: true,
  })
  @IsOptional()
  status?: InstanceStatus;

  @ApiPropertyOptional({
    description: 'Filter by quiz difficulty',
    enum: QUIZ_DIFFICULTIES,
    nullable: true,
  })
  @IsOptional()
  difficulty?: string;
}
