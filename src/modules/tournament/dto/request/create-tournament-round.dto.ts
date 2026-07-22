import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from '@/common/utils/text.util';

export class CreateTournamentRoundDto {
  @ApiProperty({
    description: 'Round name',
    minLength: 1,
    maxLength: 255,
    example: 'Quarter Finals',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    description: 'Round description',
    maxLength: 1000,
    nullable: true,
    example: 'The first elimination round of the tournament.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? trimString(value) : value))
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiProperty({
    description: 'UUID of the quiz version to use in this round',
    format: 'uuid',
    example: '990e8400-e29b-71d4-a716-446655440001',
  })
  @IsUUID('7')
  quizVersionId!: string;

  @ApiPropertyOptional({
    description:
      'Scheduled start timestamp (ISO 8601). When provided, the round auto-opens at this time. ' +
      'Must be >= the tournament startAt.',
    type: String,
    example: '2026-07-20T10:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  startAt?: string | null;

  @ApiPropertyOptional({
    description:
      'Scheduled end timestamp (ISO 8601). When provided, the round auto-closes at this time. ' +
      'Must be <= the tournament endAt.',
    type: String,
    example: '2026-07-20T11:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  endAt?: string | null;

  @ApiPropertyOptional({
    description: 'Round duration in milliseconds (question time limit)',
    minimum: 1,
    maximum: 86_400_000,
    nullable: true,
    example: 3_600_000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86_400_000)
  durationMs?: number | null;

  @ApiPropertyOptional({
    description: 'Whether incorrect answers result in elimination from the tournament',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isElimination?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of participants allowed in this round (null = unlimited)',
    minimum: 1,
    maximum: 100_000,
    nullable: true,
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  participantLimit?: number | null;
}
