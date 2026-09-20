import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
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
