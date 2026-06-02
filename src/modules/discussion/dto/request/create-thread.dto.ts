import { Transform } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { trimString } from '@/common/utils/text.util';

export class CreateThreadDto {
  @ApiProperty({
    description: 'UUID of the quiz this thread belongs to',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  quizId!: string;

  @ApiProperty({
    description: 'Thread title',
    minLength: 1,
    maxLength: 255,
    example: 'Question about JavaScript closures',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Thread body text',
    minLength: 1,
    maxLength: 10000,
    example: 'I am confused about how closures work in loops...',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;
}
