/**
 * Phase 5 #3 — admin audit log row DTO.
 *
 * Wire shape for a single row in the audit search response.
 * Mirrors the `auth_audit_logs` table columns and the
 * structured `metadata` JSON the writer pre-populates with
 * `domain`, `action`, `actorId`, and `subjectUserId`.
 */
import { ApiProperty } from '@nestjs/swagger';

export class AdminAuditRowDto {
  @ApiProperty({ description: 'Audit log id (uuid v7).', format: 'uuid' })
  readonly auditLogId!: string;

  @ApiProperty({
    description: 'Subject user id. May be `null` for unauthenticated events.',
    format: 'uuid',
    nullable: true,
  })
  readonly userId!: string | null;

  @ApiProperty({
    description: 'Free-form event identifier (legacy column).',
    example: 'password_changed',
  })
  readonly eventType!: string;

  @ApiProperty({
    description: 'Structured domain tag (set by `AuditLogService`).',
    example: 'auth',
    nullable: true,
  })
  readonly domain!: string | null;

  @ApiProperty({
    description: 'Structured action (e.g. "badge.revoked").',
    example: 'badge.revoked',
    nullable: true,
  })
  readonly action!: string | null;

  @ApiProperty({
    description: 'Actor user id (admin who performed the action, if any).',
    format: 'uuid',
    nullable: true,
  })
  readonly actorId!: string | null;

  @ApiProperty({
    description: 'Subject user id (mirror of `userId`, exposed in metadata).',
    format: 'uuid',
    nullable: true,
  })
  readonly subjectUserId!: string | null;

  @ApiProperty({
    description: 'Originating IP address, when known.',
    nullable: true,
  })
  readonly ipAddress!: string | null;

  @ApiProperty({
    description: 'Free-form structured payload. Always a JSON object.',
    type: 'object',
    additionalProperties: true,
  })
  readonly metadata!: Record<string, unknown>;

  @ApiProperty({
    description: 'When the event was recorded (ISO 8601).',
  })
  readonly createdAt!: string;
}