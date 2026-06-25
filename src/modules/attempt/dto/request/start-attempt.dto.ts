import { ApiPropertyOptional } from '@nestjs/swagger';
import { ATTEMPT_CONTEXT_TYPES, type AttemptContextType } from '../../types/attempt.types';

export class StartAttemptDto {
  @ApiPropertyOptional({
    description:
      'Optional reference ID for the context this attempt belongs to (e.g. tournament ID)',
    type: String,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  contextRefId?: string | null;

  @ApiPropertyOptional({
    description: 'Context type for this attempt',
    type: String,
    enum: ATTEMPT_CONTEXT_TYPES,
    example: 'solo',
    nullable: true,
  })
  contextType?: AttemptContextType;
}
