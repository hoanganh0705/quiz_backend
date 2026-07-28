import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { USER_PAGINATION_DEFAULT_LIMIT } from '../../domain/constants/user.domain-constants';

// Phase 7 (F-23): see `get-my-tournaments-query.dto.ts` for rationale.
const BASE64_ALPHABET = /^[A-Za-z0-9+/=]+$/;

export class GetMyTournamentsQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (base64-encoded { registeredAt, participantId })',
    example:
      'eyJyZWdpc3RlcmVkQXQiOiAiMjAyNi0wNi0wMVQwMDowMDowMFoiLCAicGFydGljaXBhbnRJZCI6ICI2NjBlODQwMC1lMjliLTMxZDQtYTcxNi00NDY2NTY1NDQwMDAifQ==',
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
