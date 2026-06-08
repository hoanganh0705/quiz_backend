import { ApiProperty } from '@nestjs/swagger';

export class BadgeProgressResponseDto {
  @ApiProperty({ description: 'Badge identifier', example: 'streak_100' })
  badgeId!: string;

  @ApiProperty({ description: 'Current user progress value', example: 56 })
  current!: number;

  @ApiProperty({ description: 'Target value required to earn the badge', example: 100 })
  target!: number;

  @ApiProperty({ description: 'Progress percentage clamped between 0 and 100', example: 56 })
  percent!: number;
}
