/**
 * Admin Achievement Response DTOs
 */

import { ApiProperty } from '@nestjs/swagger';

export class ReevaluateUserResponseDto {
  @ApiProperty({ description: 'Human-readable outcome message' })
  message!: string;

  @ApiProperty({ description: 'Number of badges checked during reevaluation' })
  checked!: number;

  @ApiProperty({ description: 'Number of badges awarded during reevaluation' })
  awarded!: number;

  @ApiProperty({ description: 'Number of errors encountered during reevaluation' })
  errors!: number;
}
