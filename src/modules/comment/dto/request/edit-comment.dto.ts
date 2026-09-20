import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from '@/common/utils/text.util';
import { MAX_COMMENT_BODY_LENGTH } from '../../domain/constants';

export class EditCommentDto {
  @ApiProperty({
    description: 'New comment body text',
    minLength: 1,
    maxLength: MAX_COMMENT_BODY_LENGTH,
    example: 'Edited: I think closures capture variables by reference.',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COMMENT_BODY_LENGTH)
  body!: string;

  @ApiPropertyOptional({
    description:
      'Caller-supplied `updatedAt` of the comment being edited. When supplied, the edit is rejected unless the row still matches; this protects against lost-update races.',
    example: '2026-08-11T10:35:00.000Z',
  })
  @IsOptional()
  @IsString()
  expectedUpdatedAt?: string;
}
