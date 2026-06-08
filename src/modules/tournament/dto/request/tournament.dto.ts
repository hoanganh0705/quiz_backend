import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TOURNAMENT_DIFFICULTIES,
  TOURNAMENT_STATUSES,
  type TournamentDifficulty,
  type TournamentStatus,
} from '../../types/tournament.types';
import { trimString, trimStringToNullIfBlank } from '@/common/utils/text.util';
export { GetTournamentParticipantsQueryDto } from './get-tournament-participants-query.dto';
export { GetTournamentWinnersQueryDto } from './get-tournament-winners-query.dto';

export const UPCOMING_TOURNAMENT_SORT_OPTIONS = ['startAt', 'registrationDeadline'] as const;
export type UpcomingTournamentSortOption = (typeof UPCOMING_TOURNAMENT_SORT_OPTIONS)[number];

export class ListTournamentsQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of tournaments to return per page',
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
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by tournament status',
    enum: TOURNAMENT_STATUSES,
    nullable: true,
  })
  @IsOptional()
  @IsIn(TOURNAMENT_STATUSES)
  status?: TournamentStatus;

  @ApiPropertyOptional({
    description: 'Filter by difficulty',
    enum: TOURNAMENT_DIFFICULTIES,
    nullable: true,
  })
  @IsOptional()
  @IsIn(TOURNAMENT_DIFFICULTIES)
  difficulty?: TournamentDifficulty;

  @ApiPropertyOptional({
    description: 'Filter by category UUID',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}

export class GetUpcomingTournamentsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Maximum number of upcoming tournaments to return per page (1-100)',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort upcoming tournaments by start date or registration deadline',
    enum: UPCOMING_TOURNAMENT_SORT_OPTIONS,
    default: 'startAt',
  })
  @IsOptional()
  @IsIn(UPCOMING_TOURNAMENT_SORT_OPTIONS)
  sortBy?: UpcomingTournamentSortOption = 'startAt';
}

export class GetActiveTournamentsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Maximum number of active tournaments to return per page (1-100)',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class GetCompletedTournamentsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Maximum number of completed tournaments to return per page (1-100)',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class GetRelatedTournamentsQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of related tournaments to return',
    minimum: 1,
    maximum: 20,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}

export class CreateTournamentDto {
  @ApiProperty({
    description: 'Tournament title',
    minLength: 1,
    maxLength: 255,
    example: 'Weekly Trivia Challenge',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Min(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    description: 'Tournament description',
    maxLength: 2000,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({
    description: 'Difficulty level',
    enum: TOURNAMENT_DIFFICULTIES,
    example: 'medium',
  })
  @IsIn(TOURNAMENT_DIFFICULTIES)
  difficulty!: TournamentDifficulty;

  @ApiPropertyOptional({
    description: 'Prize description',
    maxLength: 1000,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(1000)
  prize?: string | null;

  @ApiProperty({
    description: 'Tournament start timestamp (ISO 8601)',
    example: '2025-07-01T10:00:00.000Z',
  })
  @IsString()
  startAt!: string;

  @ApiProperty({
    description: 'Tournament end timestamp (ISO 8601)',
    example: '2025-07-01T12:00:00.000Z',
  })
  @IsString()
  endAt!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of participants',
    minimum: 2,
    default: 100,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  maxParticipants?: number;

  @ApiPropertyOptional({
    description: 'Associated category UUID',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}
