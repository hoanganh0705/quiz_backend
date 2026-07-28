import { ApiProperty } from '@nestjs/swagger';

export class ModerationResultDto {
  @ApiProperty({
    description: 'Comment identifier',
    example: '880e8400-e29b-71d4-a716-446655440000',
  })
  commentId!: string;

  @ApiProperty({
    description: 'Whether the comment is currently hidden',
    example: true,
  })
  isHidden!: boolean;

  @ApiProperty({
    description: 'Whether the moderation action actually changed the comment state',
    example: true,
  })
  changed!: boolean;
}
