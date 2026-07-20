import { ApiProperty } from '@nestjs/swagger';
import { TOURNAMENT_STATUSES } from '../../types/tournament.types';

/**
 * Phase 1 / Issue #1 — response shape for `POST /tournaments/:id/cancel`.
 *
 * Returns the canonical `{ data, meta }` envelope (the response interceptor
 * handles wrapping). The `status` field confirms the tournament moved to
 * the terminal `cancelled` state; `cancelledAt` is the timestamp recorded
 * on the row (today the column is the generic `updated_at` — there is no
 * dedicated `cancelled_at` column yet, see audit Issue #10 for the
 * future work).
 */
export class CancelTournamentResponseDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({
    description: 'Updated lifecycle status (always `cancelled` after a successful cancel)',
    enum: TOURNAMENT_STATUSES,
    example: 'cancelled',
  })
  status!: 'cancelled';

  @ApiProperty({
    description: 'Timestamp at which the cancel took effect (ISO 8601)',
    example: '2026-07-20T10:00:00.000Z',
  })
  cancelledAt!: string;
}

/**
 * Phase 1 / Issue #1 — response shape for `DELETE /tournaments/:id`
 * (soft delete).
 *
 * Mirrors the `ReviewPresenter.deleteReview` shape used in the
 * reviewer module so the two admin modules follow the same envelope
 * conventions: the response carries the deleted entity's ID plus the
 * `deletedAt` timestamp the soft-delete column was set to.
 */
export class SoftDeleteTournamentResponseDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({
    description:
      'Timestamp at which the soft delete took effect (ISO 8601). The tournament row remains in the database for audit and reconciliation purposes; reads filter `deleted_at IS NULL` so the row is invisible to clients.',
    example: '2026-07-20T10:00:00.000Z',
  })
  deletedAt!: string;
}
