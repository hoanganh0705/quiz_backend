import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Enable or disable in-app notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable email notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable push notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable achievement and badge notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  achievementEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable tournament-related notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  tournamentEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable rank change notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  rankEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable friend activity notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  friendEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable discussion reply and mention notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  discussionEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable weekly summary digest notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  summaryEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable marketing and promotional notifications',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  marketingEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Minimum number of rank positions improved before a rank notification is sent (1–100)',
    minimum: 1,
    maximum: 100,
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rankImprovementThreshold?: number;

  @ApiPropertyOptional({
    description:
      'Quiet hours start time in HH:MM format. Notifications will be suppressed starting at this time.',
    example: '22:00',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  quietHoursStart?: string | null;

  @ApiPropertyOptional({
    description: 'Quiet hours end time in HH:MM format. Notifications will resume after this time.',
    example: '08:00',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  quietHoursEnd?: string | null;
}
