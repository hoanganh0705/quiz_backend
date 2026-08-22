/**
 * Phase 5 #3 — admin audit log search DTO.
 *
 * Query string for `GET /admin/audit/search`. Filters compose
 * with logical AND: a row must match every filter to be
 * returned. Pagination is offset-based (the audit log is a
 * closed set with a finite retention window, so cursor-based
 * pagination is not needed).
 *
 * Filtering options
 * -----------------
 *   - `eventType` — substring match on the free-form event
 *     identifier (`password_changed`, `account_deleted`, …).
 *     For backward compatibility, callers can also filter by
 *     the structured `domain` + `action` pair below.
 *   - `domain` — exact match on the structured `domain` field
 *     (`auth`, `user`, `achievement`, `review`, `social`,
 *     `quiz`, `comment`).
 *   - `action` — exact match on the structured `action` field
 *     (`badge.revoked`, `review.report.status_changed`, …).
 *   - `userId` — exact match on the indexed `user_id` column
 *     (subject user).
 *   - `actorId` — exact match on the structured `actorId`
 *     field (the user/admin who performed the action).
 *   - `from` / `to` — inclusive ISO 8601 timestamp range on
 *     `createdAt`.
 *
 * Pagination
 * ----------
 *   - `limit` — capped at 100 to keep the payload bounded.
 *   - `page` — 1-indexed. `1` is the default.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { AuditDomain } from '@/common/audit/audit-log.service';

export class AdminAuditSearchQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by event type (substring match, case-insensitive).',
    example: 'password',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({
    description: 'Filter by structured domain.',
    enum: ['auth', 'user', 'achievement', 'review', 'social', 'quiz', 'comment'],
  })
  @IsOptional()
  @IsString()
  domain?: AuditDomain;

  @ApiPropertyOptional({
    description: 'Filter by structured action (e.g. "badge.revoked").',
    example: 'badge.revoked',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter by subject user id.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by actor (admin/user) id.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Inclusive lower bound for `createdAt` (ISO 8601).',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound for `createdAt` (ISO 8601).',
    example: '2026-08-19T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description: '1-indexed page number (default 1).',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Maximum rows per page (default 50, capped at 100).',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}