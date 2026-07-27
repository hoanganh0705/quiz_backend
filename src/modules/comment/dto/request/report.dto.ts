import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from '@/common/utils/text.util';
import {
  MAX_REPORT_DETAILS_LENGTH,
  MAX_REPORT_REASON_LENGTH,
} from '../../domain/constants';

export class ReportCommentDto {
  @ApiProperty({
    description: 'Short reason for the report',
    minLength: 1,
    maxLength: MAX_REPORT_REASON_LENGTH,
    example: 'spam',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_REPORT_REASON_LENGTH)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Optional longer explanation',
    type: String,
    maxLength: MAX_REPORT_DETAILS_LENGTH,
    nullable: true,
    example: 'Repeated promotional links.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(MAX_REPORT_DETAILS_LENGTH)
  details?: string | null;
}
