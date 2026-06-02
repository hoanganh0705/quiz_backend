import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoteDto {
  @ApiProperty({
    description: 'Type of content being voted on',
    enum: ['thread', 'comment', 'reply'],
    example: 'comment',
  })
  @IsIn(['thread', 'comment', 'reply'])
  targetType!: 'thread' | 'comment' | 'reply';

  @ApiProperty({
    description: 'UUID of the thread, comment, or reply being voted on',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  targetId!: string;

  @ApiProperty({
    description: 'Vote value',
    enum: ['upvote', 'downvote'],
    example: 'upvote',
  })
  @IsIn(['upvote', 'downvote'])
  value!: 'upvote' | 'downvote';
}

export class RemoveVoteDto {
  @ApiProperty({
    description: 'Type of content the vote belongs to',
    enum: ['thread', 'comment', 'reply'],
    example: 'comment',
  })
  @IsIn(['thread', 'comment', 'reply'])
  targetType!: 'thread' | 'comment' | 'reply';

  @ApiProperty({
    description: 'UUID of the thread, comment, or reply the vote belongs to',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  targetId!: string;
}
