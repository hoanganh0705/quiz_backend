import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ATTEMPT_CONTEXT_TYPES, type AttemptContextType } from '../../types/attempt.types';

export class StartAttemptDto {
  @ApiPropertyOptional({
    description:
      'Optional reference ID for the context this attempt belongs to (e.g. tournament ID)',
    type: String,
    nullable: true,
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('7', { message: 'contextRefId must be a valid UUID' })
  contextRefId?: string | null;

  @ApiPropertyOptional({
    description: 'Context type for this attempt',
    type: String,
    enum: ATTEMPT_CONTEXT_TYPES,
    example: 'solo',
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ATTEMPT_CONTEXT_TYPES, {
    message: `contextType must be one of: ${ATTEMPT_CONTEXT_TYPES.join(', ')}`,
  })
  contextType?: AttemptContextType;
}
