/**
 * Admin Achievement Response DTOs
 */

import { ApiProperty } from '@nestjs/swagger';

export class ReevaluateUserResponseDto {
  @ApiProperty({ description: 'Human-readable outcome message' })
  message!: string;

  @ApiProperty({ description: 'Number of badges checked during reevaluation' })
  checked!: number;

  @ApiProperty({ description: 'Number of badges awarded during reevaluation' })
  awarded!: number;

  @ApiProperty({ description: 'Number of errors encountered during reevaluation' })
  errors!: number;
}

export class AdminAchievementHistoryItemDto {
  @ApiProperty({ description: 'Unique user-badge ownership identifier' })
  userBadgeId!: string;

  @ApiProperty({ description: 'User identifier' })
  userId!: string;

  @ApiProperty({ description: 'Badge identifier' })
  badgeId!: string;

  @ApiProperty({ description: 'URL-friendly badge slug' })
  badgeSlug!: string;

  @ApiProperty({ description: 'Badge display name' })
  badgeName!: string;

  @ApiProperty({ description: 'Badge type' })
  badgeType!: string;

  @ApiProperty({ description: 'Badge category' })
  badgeCategory!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp when the badge was earned' })
  earnedAt!: string;

  @ApiProperty({ description: 'Badge version at the time of award' })
  badgeVersion!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the badge expires',
    nullable: true,
  })
  expiresAt!: string | null;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the badge was revoked',
    nullable: true,
  })
  revokedAt!: string | null;

  @ApiProperty({
    description: 'Reason for revocation',
    type: String,
    nullable: true,
  })
  revocationReason!: string | null;

  @ApiProperty({ description: 'Additional badge metadata', type: Object })
  metadata!: Record<string, unknown>;

  @ApiProperty({ description: 'Whether the badge is currently active' })
  isActive!: boolean;
}
