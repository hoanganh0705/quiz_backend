import { ApiProperty } from '@nestjs/swagger';

export class TimeSeriesPointDto {
  @ApiProperty({
    description: 'Point timestamp in ISO 8601 format',
    example: '2026-08-01T00:00:00.000Z',
  })
  date!: string;

  @ApiProperty({
    description: 'Value at the point timestamp (units depend on the series)',
    example: 12,
  })
  value!: number;
}

export class TimeSeriesDto {
  @ApiProperty({
    description: 'Series bucket (day|week|month)',
    example: 'day',
  })
  bucket!: 'day' | 'week' | 'month';

  @ApiProperty({
    description: 'Series unit label',
    example: 'xp',
  })
  unit!: string;

  @ApiProperty({
    description: 'Series points sorted chronologically',
    type: () => [TimeSeriesPointDto],
  })
  points!: TimeSeriesPointDto[];
}
