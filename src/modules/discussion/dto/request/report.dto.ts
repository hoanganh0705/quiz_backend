import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimStringToNullIfBlank } from '@/common/utils/text.util';

export class ReportDto {
  @ApiProperty({
    description: 'Type of content being reported',
    enum: ['thread', 'comment', 'reply'],
    example: 'comment',
  })
  @IsIn(['thread', 'comment', 'reply'])
  targetType!: 'thread' | 'comment' | 'reply';

  @ApiProperty({
    description: 'UUID of the thread, comment, or reply being reported',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  targetId!: string;

  @ApiProperty({
    description: 'Reason for reporting',
    minLength: 3,
    maxLength: 200,
    example: 'spam',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Additional details about the report',
    maxLength: 1000,
    example: 'This comment contains repeated promotional links.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string | null;
}
