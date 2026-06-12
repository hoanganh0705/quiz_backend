import { IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VoteTargetType, VoteValue } from './enums';

export class VoteDto {
  @ApiProperty({
    description: 'Type of content being voted on',
    enum: VoteTargetType,
    example: 'comment',
  })
  @IsEnum(VoteTargetType)
  targetType!: VoteTargetType;

  @ApiProperty({
    description: 'UUID of the thread, comment, or reply being voted on',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  targetId!: string;

  @ApiProperty({
    description: 'Vote value',
    enum: VoteValue,
    example: 'upvote',
  })
  @IsEnum(VoteValue)
  value!: VoteValue;
}

export class RemoveVoteDto {
  @ApiProperty({
    description: 'Type of content the vote belongs to',
    enum: VoteTargetType,
    example: 'comment',
  })
  @IsEnum(VoteTargetType)
  targetType!: VoteTargetType;

  @ApiProperty({
    description: 'UUID of the thread, comment, or reply the vote belongs to',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  targetId!: string;
}
