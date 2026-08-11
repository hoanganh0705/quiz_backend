import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Phase 3 (S-14): the day's daily-challenge snapshot.
 *
 * This is the public-facing DTO returned by
 * `GET /daily-challenge/today`. The `status` discriminator carries
 * the lifecycle state:
 *   - `'pending'`   — the day's quiz is published; the user has
 *                     not yet completed an attempt.
 *   - `'completed'` — the user has completed today's attempt.
 *   - `'expired'`   — the day's window has closed (the next day's
 *                     challenge has been rotated in).
 *
 * The frontend's `<DailyChallengeCard />` switches on
 * `status` to decide whether to render the "play" CTA, the
 * "play again" recap, or the "expired" placeholder.
 */
export class DailyChallengeResponseDto {
  @ApiProperty({
    description: 'Challenge date (ISO 8601, midnight UTC)',
    example: '2026-08-10T00:00:00.000Z',
  })
  date!: string;

  @ApiProperty({
    description: 'Quiz identifier for the day',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title rendered on the card',
    example: 'JavaScript Fundamentals',
  })
  quizTitle!: string;

  @ApiProperty({
    description: 'Quiz slug for deep-linking into the player',
    example: 'javascript-fundamentals',
  })
  slug!: string;

  @ApiProperty({
    description: "Quiz difficulty surfaced on the day's card",
    example: 'medium',
    enum: ['easy', 'medium', 'hard'],
  })
  difficulty!: 'easy' | 'medium' | 'hard';

  @ApiProperty({
    description: 'Total question count for the published version',
    example: 12,
  })
  questionCount!: number;

  @ApiProperty({
    description: 'XP awarded on completion of the day',
    example: 100,
  })
  rewardXp!: number;

  @ApiProperty({
    description: 'Timestamp at which the day window expires (next 00:00 UTC)',
    example: '2026-08-11T00:00:00.000Z',
  })
  expiresAt!: string;

  @ApiProperty({
    description: 'Lifecycle status — see class header for semantics',
    example: 'pending',
    enum: ['pending', 'completed', 'expired'],
  })
  status!: 'pending' | 'completed' | 'expired';

  @ApiPropertyOptional({
    description:
      "Best-score percentage for the viewer on this day's attempt (0–100). " +
      'Only present when the viewer has completed the day.',
    example: 92.5,
    nullable: true,
  })
  scorePercent!: number | null;

  @ApiPropertyOptional({
    description:
      '1-indexed global rank the viewer achieved on the day. Only present when ' +
      "the viewer has completed the day's attempt.",
    example: 7,
    nullable: true,
  })
  rank!: number | null;
}
