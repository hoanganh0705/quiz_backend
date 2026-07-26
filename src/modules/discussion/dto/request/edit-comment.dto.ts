import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
}
