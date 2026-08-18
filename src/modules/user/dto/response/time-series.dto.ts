import { ApiProperty } from '@nestjs/swagger';

/**
 * `TimeSeriesPointDto` — a single (timestamp, value) point in a
 * time-series bundle. The series is sorted chronologically
 * (oldest first) and gaps are densified to zero so the client can
 * render a continuous chart without further math.
 */
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

/**
 * `TimeSeriesDto` — a generic time-series bundle for the user
 * profile page (Phase 4 / S-25). Used for `xpHistory` on the
 * my-profile bundle; additional series (rank history, streak
 * history) can reuse the same shape.
 */
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
