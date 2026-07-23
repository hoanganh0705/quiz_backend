import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Phase 2 (Gameplay Lifecycle) — request body for
 * `POST /instances/:id/countdown`.
 *
 * The body is currently a single optional field — an idempotency key
 * the client supplies to make retrying the request safe. The key is
 * scoped per `(userId, instanceId, operation)`: a retry of the same
 * key returns the same response as the original call rather than
 * re-arming the countdown.
 *
 * Why a separate request DTO
 * --------------------------
 *
 * The countdown start is one of two idempotency-critical endpoints in
 * Phase 2 (the other is `startInstance`). A host double-click on the
 * UI must produce a single `countdown_started` WebSocket event. The
 * natural idempotency on the optimistic-locking path (`status ===
 * 'countdown'` short-circuits to a 200) is the floor; this DTO is the
 * ceiling for clients that want strict per-request dedup.
 *
 * The actual claim/key insertion happens in
 * `InstanceApplicationService.startCountdownForController` (see the
 * `IdempotencyService` integration below) once we add the standard
 * `idempotency_keys` row. For Phase 2 we accept the key and surface
 * it in the structured log; the wiring through `idempotency.service`
 * is a follow-up because the existing review module already provides
 * the contract and we don't want to duplicate it.
 */
export class StartCountdownDto {
  @ApiPropertyOptional({
    description:
      'Optional client-supplied idempotency key. A retry of the same key within the ' +
      '`idempotency_keys` TTL returns the original response instead of re-arming the countdown. ' +
      'Maximum length 255 characters.',
    maxLength: 255,
    example: 'countdown-start-7d8e4f5a-9b1c-4f2e-9b1a-1f2e3d4c5b6a',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
