import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TOURNAMENT_DIFFICULTIES, type TournamentDifficulty } from '../../types/tournament.types';
import { trimString, trimStringToNullIfBlank } from '@/common/utils/text.util';

/**
 * Phase 1 / Issue #1 — request body for `PATCH /tournaments/:id`.
 *
 * Every field is optional. The application-layer service rejects the
 * request with `TournamentValidationError` if **no** field is provided
 * — a `PATCH` that ships an empty body would otherwise silently
 * succeed and bump `updated_at` without changing anything.
 *
 * State guards (the audit's `Issue #10`) live in the service layer,
 * not here: this DTO does not know what `status` the tournament is
 * currently in. The service compares each mutable field against the
 * current `tournament.status`:
 *
 *   - `status === 'upcoming'`         ⇒ every field is editable.
 *   - `status === 'registration'`     ⇒ `maxParticipants` may be
 *                                       **increased** only (the audit
 *                                       bans shrinking the cap once
 *                                       users have started registering
 *                                       — that would silently evict
 *                                       already-registered users).
 *   - `status === 'ongoing'`          ⇒ only `prize` is editable.
 *   - `status === 'finished' | 'cancelled'` ⇒ 409 Conflict.
 *
 * Non-blank invariant: every nullable string is normalized via
 * `trimStringToNullIfBlank` so `""`, `"   "`, and `null` all collapse
 * to `null`. That matches the column's nullable behavior and keeps the
 * wire shape unambiguous.
 *
 * Note: `startAt` / `endAt` order is enforced in the service layer
 * (`endAt > startAt`) — class-validator cannot compare two optional
 * ISO-8601 fields with custom semantics cleanly, and putting the check
 * in two places would risk a discrepancy.
 */
export class UpdateTournamentDto {
  @ApiPropertyOptional({
    description: 'Tournament title',
    minLength: 1,
    maxLength: 255,
    example: 'Weekly Trivia Challenge (revised)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Min(1)
  @MaxLength(255)
  title?: string;

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

  @ApiPropertyOptional({
    description: 'Difficulty level',
    enum: TOURNAMENT_DIFFICULTIES,
    example: 'hard',
  })
  @IsOptional()
  @IsString()
  difficulty?: TournamentDifficulty;

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

  @ApiPropertyOptional({
    description:
      'Tournament start timestamp (ISO 8601). Only editable while the tournament is in the `upcoming` status.',
    example: '2025-07-01T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({
    description:
      'Tournament end timestamp (ISO 8601). Only editable while the tournament is in the `upcoming` status. Must remain strictly after `startAt`.',
    example: '2025-07-01T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({
    description:
      'Maximum number of participants. While the tournament is in `registration` only increases are accepted; passing a value lower than the current `maxParticipants` is rejected with `409 Conflict`.',
    minimum: 2,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100_000)
  maxParticipants?: number;

  @ApiPropertyOptional({
    description: 'Associated category UUID. Pass `null` to clear the category binding.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  categoryId?: string;
}
