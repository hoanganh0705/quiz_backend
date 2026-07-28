import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorDto } from './author.dto';
import { VOTE_VALUE } from '../../domain/types';

export type VoteValueWire = (typeof VOTE_VALUE)[number] | null;

/**
 * Wire-shape projection of a comment returned by every comment
 * endpoint that addresses a single comment. The field set is
 * deliberately identical between this DTO and the read projection
 * returned by the repository (`CommentView`) — the controller-level
 * mapping is a 1:1 rename of `id` → `id` (the field name was
 * already `id` on the read projection; the legacy DTO used
 * `commentId` and is removed).
 */
export class CommentDto {
  @ApiProperty({
    description: 'Comment identifier',
    example: '880e8400-e29b-71d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Quiz this comment belongs to',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Author identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  authorId!: string;

  @ApiProperty({ description: 'Comment author profile', type: () => AuthorDto })
  author!: AuthorDto;

  @ApiPropertyOptional({
    description: 'Parent comment identifier when this is a reply',
    type: String,
    nullable: true,
    example: '880e8400-e29b-71d4-a716-446655440001',
  })
  parentCommentId!: string | null;

  @ApiProperty({ description: 'Comment body text', example: 'Great question!' })
  body!: string;

  @ApiProperty({
    description: 'Whether the comment is hidden by a moderator',
    example: false,
  })
  isHidden!: boolean;

  @ApiProperty({
    description: 'Moderator who hid this comment, if hidden',
    type: String,
    nullable: true,
    example: null,
  })
  hiddenById!: string | null;

  @ApiProperty({
    description: 'Timestamp at which the comment was hidden',
    type: String,
    nullable: true,
    example: null,
  })
  hiddenAt!: string | null;

  @ApiProperty({ description: 'Net vote count', example: 5 })
  votesCount!: number;

  @ApiProperty({ description: 'Upvote count', example: 6 })
  upvotesCount!: number;

  @ApiProperty({ description: 'Downvote count', example: 1 })
  downvotesCount!: number;

  @ApiProperty({ description: 'Number of direct replies', example: 3 })
  repliesCount!: number;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-02T10:35:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2026-06-02T10:45:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Soft deletion timestamp in ISO 8601 format',
    type: String,
    nullable: true,
    example: null,
  })
  deletedAt!: string | null;
}

/**
 * Wire-shape projection of a top-level comment with its first page
 * of replies. Returned by `GET /quizzes/:quizId/comments` so the
 * client can render a comment + its visible replies in a single
 * round-trip.
 */
export class CommentWithRepliesDto extends CommentDto {
  @ApiProperty({ description: 'First page of replies', type: () => [CommentDto] })
  replies!: CommentDto[];

  @ApiPropertyOptional({
    description: "The authenticated viewer's vote on this comment, if any",
    enum: VOTE_VALUE,
    type: String,
    nullable: true,
    example: 'upvote',
  })
  userVote!: VoteValueWire;
}
