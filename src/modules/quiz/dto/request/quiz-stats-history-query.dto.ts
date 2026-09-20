import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export class QuizStatsHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Window length',
    example: '30d',
    default: '30d',
    enum: ['7d', '30d'],
  })
  @IsOptional()
  @IsIn(['7d', '30d'])
  range?: '7d' | '30d' = '30d';

  @ApiPropertyOptional({
    description: 'Bucket size',
    example: 'day',
    default: 'day',
    enum: ['day', 'hour'],
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['day', 'hour'])
  bucket?: 'day' | 'hour' = 'day';
}
