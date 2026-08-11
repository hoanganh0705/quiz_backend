import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Query DTO for `GET /users/me/quiz-history/export`.
 *
 * Phase 5 (S-30): streams a CSV or JSON file of the authenticated
 * user's quiz history. Streams Content-Type so the browser triggers
 * a file download with the right extension.
 */
export class QuizHistoryExportQueryDto {
  @ApiPropertyOptional({
    description: 'File format to export',
    type: String,
    enum: ['csv', 'json'],
    default: 'csv',
    nullable: true,
    example: 'csv',
  })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';

  @ApiPropertyOptional({
    description: 'Filter attempts by status',
    type: String,
    enum: ['started', 'completed', 'abandoned'],
    nullable: true,
    example: 'completed',
  })
  @IsOptional()
  @IsIn(['started', 'completed', 'abandoned'])
  status?: 'started' | 'completed' | 'abandoned';

  @ApiPropertyOptional({
    description: 'Filter attempts created on or after this ISO 8601 timestamp',
    type: String,
    nullable: true,
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter attempts created on or before this ISO 8601 timestamp',
    type: String,
    nullable: true,
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsString()
  toDate?: string;
}
