import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { USER_PAGINATION_DEFAULT_LIMIT } from '../../domain/constants/user.domain-constants';

// Phase 7 (F-23): see `get-my-tournaments-query.dto.ts` for rationale.
const BASE64_ALPHABET = /^[A-Za-z0-9+/=]+$/;

export class GetMyTournamentHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (base64-encoded { completedAt, participantId })',
    example:
      'eyJjb21wbGV0ZWRBdCI6ICIyMDI2LTA2LTAxVDAwOjAwOjAwWiIsICJwYXJ0aWNpcGFudElkIjogIjY2MGU4NDgwLWUyOWItMzFkNC1hNzE2LTQ0NjY1NjU0NDAwMCJ9',
  })
  @IsOptional()
  @IsString()
  @Matches(BASE64_ALPHABET)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1-100)',
    minimum: 1,
    maximum: 100,
    default: USER_PAGINATION_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = USER_PAGINATION_DEFAULT_LIMIT;
}
