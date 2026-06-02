import { IsBoolean, IsOptional, IsInt, Min, Max, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  achievementEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  tournamentEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  rankEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  friendEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  summaryEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rankImprovementThreshold?: number;

  @IsOptional()
  @IsString()
  quietHoursStart?: string | null;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string | null;
}
