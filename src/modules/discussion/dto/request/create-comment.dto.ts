import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from '@/common/utils/text.util';
import { MAX_COMMENT_BODY_LENGTH } from '../../domain/constants';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment body text',
    minLength: 1,
    maxLength: MAX_COMMENT_BODY_LENGTH,
    example: 'Great question!',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COMMENT_BODY_LENGTH)
  body!: string;

  @ApiPropertyOptional({
    description:
      'UUID of the parent comment when this is a reply. The parent must be a top-level comment on the same quiz.',
    format: 'uuid',
    nullable: true,
    example: '880e8400-e29b-71d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID('7', { message: 'parentCommentId must be a valid UUID' })
  parentCommentId?: string;
}
