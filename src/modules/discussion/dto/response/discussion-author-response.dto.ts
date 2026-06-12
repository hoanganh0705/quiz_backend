import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DiscussionAuthorResponseDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'quiz_master' })
  username!: string;

  @ApiPropertyOptional({ description: 'Display name', nullable: true, example: 'Quiz Master' })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    nullable: true,
    example: 'https://cdn.example.com/avatar.png',
  })
  avatarUrl!: string | null;
}
