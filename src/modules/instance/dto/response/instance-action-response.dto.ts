import { ApiProperty } from '@nestjs/swagger';

export class CreateInstanceResponseDto {
  @ApiProperty({
    description: 'New instance identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Human-readable confirmation message',
    example: 'Instance created successfully',
  })
  message!: string;
}

export class JoinInstanceResponseDto {
  @ApiProperty({
    description: 'Human-readable confirmation message returned by the join handler',
    example: 'Joined the instance successfully',
  })
  message!: string;
}

export class StartInstanceResponseDto {
  @ApiProperty({
    description: 'Human-readable confirmation message returned by the start handler',
    example: 'Instance started',
  })
  message!: string;
}

export class CloseInstanceResponseDto {
  @ApiProperty({
    description: 'Human-readable confirmation message returned by the close handler',
    example: 'Instance closed',
  })
  message!: string;
}

/**
 * Phase 2 (Gameplay Lifecycle) — returned by `POST /instances/:id/countdown`.
 * Carries the wall-clock anchor the WebSocket `countdown_started` event
 * also publishes. The `status` is always `'countdown'` — the controller
 * is the only entry point that uses this DTO.
 *
 * Design note (Phase 7 — audit Finding 7): unlike other action responses
 * (`JoinInstanceResponseDto`, `StartInstanceResponseDto`, etc.) which
 * return `{ message: string }`, this DTO returns the full countdown state
 * (`instanceId`, `status`, `countdownStartedAt`, `countdownEndsAt`). This
 * is intentional because:
 *   1. The client needs the exact `countdownEndsAt` to render a countdown
 *      timer in the UI without having to re-fetch the instance.
 *   2. The timing data is generated server-side and cannot be reliably
 *      computed client-side (clock skew).
 *   3. Returning this data avoids an additional round-trip to
 *      `GET /instances/{id}` after starting the countdown.
 * Clients that only need confirmation can ignore the additional fields.
 */
export class StartCountdownResponseDto {
  @ApiProperty({
    description: 'Instance identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Status of the instance after the countdown started',
    enum: ['countdown'],
    example: 'countdown',
  })
  status!: 'countdown';

  @ApiProperty({
    description: 'Wall-clock instant the countdown started (ISO 8601 UTC)',
    example: '2026-07-23T08:30:00.000Z',
  })
  countdownStartedAt!: string;

  @ApiProperty({
    description:
      'Wall-clock instant the countdown will fire and the instance transitions to running (ISO 8601 UTC)',
    example: '2026-07-23T08:30:05.000Z',
  })
  countdownEndsAt!: string;
}

export class CancelCountdownResponseDto {
  @ApiProperty({
    description: 'Human-readable confirmation message returned by the cancel handler',
    example: 'Countdown cancelled',
  })
  message!: string;
}
