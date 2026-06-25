import { ApiProperty } from '@nestjs/swagger';

export class SocialCountsDto {
  @ApiProperty({ description: 'Number of mutual friends', example: 12 })
  friendCount!: number;

  @ApiProperty({ description: 'Number of followers', example: 34 })
  followerCount!: number;

  @ApiProperty({ description: 'Number of accounts the user is following', example: 28 })
  followingCount!: number;
}

export class UserSocialStatsResponseDto {
  @ApiProperty({ description: 'Number of accepted friendships', example: 120 })
  friends!: number;

  @ApiProperty({ description: 'Number of followers', example: 450 })
  followers!: number;

  @ApiProperty({ description: 'Number of accounts the user is following', example: 78 })
  following!: number;
}

export class MySocialAnalyticsResponseDto {
  @ApiProperty({ description: 'Current accepted friendship count', example: 42 })
  friends!: number;

  @ApiProperty({ description: 'Current follower count', example: 120 })
  followers!: number;

  @ApiProperty({ description: 'Current following count', example: 88 })
  following!: number;

  @ApiProperty({ description: 'Net follower growth over the last 30 days', example: 12 })
  growth30Days!: number;
}
