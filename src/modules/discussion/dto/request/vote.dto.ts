import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VOTE_VALUE, type VoteValue } from '../../domain/types';

export class VoteDto {
  @ApiProperty({
    description: 'Vote value',
    enum: VOTE_VALUE,
    example: 'upvote',
  })
  @IsIn(VOTE_VALUE)
  value!: VoteValue;
}
