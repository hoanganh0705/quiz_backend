import { ApiProperty } from '@nestjs/swagger';

/**
 * Wire-shape projection of a comment author. Same shape as the
 * pre-refactor `discussionAuthorResponse` minus the legacy fields
 * (level, joinedAt, …) that were removed in the comment-only
 * refactor.
 */
export class AuthorDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Unique username', example: 'alice' })
  username!: string;

  @ApiProperty({
    description: 'Display name, if set',
    nullable: true,
    example: 'Alice',
  })
  displayName!: string | null;

  @ApiProperty({
    description: 'Avatar URL, if set',
    nullable: true,
    example: 'https://cdn.example.com/avatars/alice.png',
  })
  avatarUrl!: string | null;
}
