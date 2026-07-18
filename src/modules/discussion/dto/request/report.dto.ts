import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DISCUSSION_REPORT_TARGET_TYPE } from '../../domain/types';
import type { DiscussionReportTargetType } from '../../domain/types';

export class CreateReportDto {
  @ApiProperty({
    description: 'Type of content being reported',
    enum: DISCUSSION_REPORT_TARGET_TYPE,
    example: 'comment',
  })
  @IsIn(DISCUSSION_REPORT_TARGET_TYPE)
  targetType!: DiscussionReportTargetType;

  @ApiProperty({
    description: 'UUID of the thread, comment, or reply being reported',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @IsUUID('7')
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
    type: String,
    maxLength: 1000,
    example: 'This comment contains repeated promotional links.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string | null;
}
