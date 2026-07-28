import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserMeResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'alice_wonder' })
  username!: string;

  @ApiProperty({ description: 'Email address', example: 'alice@example.com' })
  email!: string;

  @ApiPropertyOptional({
    description: 'Display name',
    type: String,
    example: 'Alice',
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    type: String,
    format: 'uri',
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiPropertyOptional({
    description: 'User bio',
    type: String,
    example: 'Quiz enthusiast',
    nullable: true,
  })
  bio!: string | null;

  @ApiProperty({
    description:
      'Total experience points earned. A value of 0 means the user has no `user_ranking` ' +
      'row yet (brand-new user). The row is created and this value is initialised the first ' +
      'time the user reads `GET /users/me/ranking` (write-on-read upsert — see audit F-19).',
    example: 15420,
  })
  xpTotal!: number;

  @ApiProperty({ description: 'Current daily quiz streak', example: 7 })
  currentStreak!: number;

  @ApiProperty({ description: 'Longest daily quiz streak ever', example: 14 })
  longestStreak!: number;

  @ApiProperty({
    description: 'User preferences',
    example: { theme: 'dark', notifications: true },
  })
  settings!: Record<string, unknown>;

  @ApiProperty({
    description: 'Account creation timestamp (ISO 8601)',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description:
      'Last write to the user record (any column, not just profile). ISO 8601 timestamp.',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}
