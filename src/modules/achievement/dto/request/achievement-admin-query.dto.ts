/**
 * Admin Achievement Request DTOs
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ReevaluateUserQueryDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'Revoked-by user ID (admin actor). Defaults to the target userId if not provided.',
  })
  revokedBy?: string;
}
