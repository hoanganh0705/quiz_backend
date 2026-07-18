import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from '@/common/utils/text.util';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment body text',
    minLength: 1,
    maxLength: 5000,
    example: 'I think closures capture variables by reference, not by value.',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({
    description: 'UUID of the parent comment if this is a reply',
    format: 'uuid',
    example: '770e8400-e29b-71d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7', { message: 'parentCommentId must be a valid UUID' })
  parentCommentId?: string;
}
