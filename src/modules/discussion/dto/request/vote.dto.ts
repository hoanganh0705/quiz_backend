import { IsIn, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DISCUSSION_REPORT_TARGET_TYPE, DISCUSSION_VOTE_VALUE } from '../../domain/types';
import type { DiscussionReportTargetType, DiscussionVoteValue } from '../../domain/types';

export class VoteDto {
  @ApiProperty({
    description: 'Type of content being voted on',
    enum: DISCUSSION_REPORT_TARGET_TYPE,
    example: 'comment',
  })
  @IsIn(DISCUSSION_REPORT_TARGET_TYPE)
  targetType!: DiscussionReportTargetType;

  @ApiProperty({
    description: 'UUID of the thread, comment, or reply being voted on',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  targetId!: string;

  @ApiProperty({
    description: 'Vote value',
    enum: DISCUSSION_VOTE_VALUE,
    example: 'upvote',
  })
  @IsIn(DISCUSSION_VOTE_VALUE)
  value!: DiscussionVoteValue;
}

export class RemoveVoteDto {
  @ApiProperty({
    description: 'Type of content the vote belongs to',
    enum: DISCUSSION_REPORT_TARGET_TYPE,
    example: 'comment',
  })
  @IsIn(DISCUSSION_REPORT_TARGET_TYPE)
  targetType!: DiscussionReportTargetType;

  @ApiProperty({
    description: 'UUID of the thread, comment, or reply the vote belongs to',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  targetId!: string;
}
