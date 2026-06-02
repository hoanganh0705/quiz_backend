import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { trimString } from '@/common/utils/text.util';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Updated comment body text',
    minLength: 1,
    maxLength: 5000,
    example: 'After checking the MDN docs, I now understand closures capture by reference.',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
