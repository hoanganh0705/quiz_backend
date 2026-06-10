import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetMyTournamentsQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (base64-encoded { registeredAt, participantId })',
    example: 'eyJyZWdpc3RlcmVkQXQiOiAiMjAyNi0wNi0wMVQwMDowMDowMFoiLCAicGFydGljaXBhbnRJZCI6ICI2NjBlODQwMC1lMjliLTMxZDQtYTcxNi00NDY2NTY1NDQwMDAifQ==',
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
  limit?: number;
}
