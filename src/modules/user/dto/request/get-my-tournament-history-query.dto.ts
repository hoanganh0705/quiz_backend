import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetMyTournamentHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (base64-encoded { completedAt, participantId })',
    example:
      'eyJjb21wbGV0ZWRBdCI6ICIyMDI2LTA2LTAxVDAwOjAwOjAwWiIsICJwYXJ0aWNpcGFudElkIjogIjY2MGU4NDgwLWUyOWItMzFkNC1hNzE2LTQ0NjY1NjU0NDAwMCJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1-100)',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
