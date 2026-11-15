import { ApiProperty } from '@nestjs/swagger';

export class AdminUserRowDto {
  @ApiProperty({ description: 'User unique identifier (UUIDv7)', format: 'uuid' })
  readonly userId!: string;

  @ApiProperty({ description: 'Unique username', example: 'alex_quizzer' })
  readonly username!: string;

  @ApiProperty({ description: 'User email address', example: 'alex@example.com' })
  readonly email!: string;

  @ApiProperty({ description: 'Public display name', nullable: true, example: 'Alex Smith' })
  readonly displayName!: string | null;

  @ApiProperty({ description: 'Avatar image URL', nullable: true, example: 'https://example.com/avatar.jpg' })
  readonly avatarUrl!: string | null;

  @ApiProperty({ description: 'System role', enum: ['user', 'moderator', 'admin'], example: 'user' })
  readonly role!: 'user' | 'moderator' | 'admin';

  @ApiProperty({ description: 'Whether the email has been verified', example: true })
  readonly isVerified!: boolean;

  @ApiProperty({ description: 'Current daily login streak', example: 5 })
  readonly currentStreak!: number;

  @ApiProperty({ description: 'Longest daily login streak', example: 12 })
  readonly longestStreak!: number;

  @ApiProperty({ description: 'Total accumulated XP points', example: 350 })
  readonly xpTotal!: number;

  @ApiProperty({ description: 'Account creation timestamp (ISO 8601)' })
  readonly createdAt!: string;

  @ApiProperty({ description: 'Account last updated timestamp (ISO 8601)' })
  readonly updatedAt!: string;

  @ApiProperty({ description: 'Soft deletion timestamp (ISO 8601)', nullable: true })
  readonly deletedAt!: string | null;
}
