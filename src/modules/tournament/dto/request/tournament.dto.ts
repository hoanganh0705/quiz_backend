import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TOURNAMENT_DIFFICULTIES,
  TOURNAMENT_STATUSES,
  type TournamentDifficulty,
  type TournamentStatus,
} from '../../types/tournament.types';
import { trimString, trimStringToNullIfBlank } from '@/common/utils/text.util';
import { Transform } from 'class-transformer';

export class ListTournamentsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(TOURNAMENT_STATUSES)
  status?: TournamentStatus;

  @IsOptional()
  @IsIn(TOURNAMENT_DIFFICULTIES)
  difficulty?: TournamentDifficulty;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}

export class CreateTournamentDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Min(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsIn(TOURNAMENT_DIFFICULTIES)
  difficulty!: TournamentDifficulty;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(1000)
  prize?: string | null;

  @IsString()
  startAt!: string;

  @IsString()
  endAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  maxParticipants?: number;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}
