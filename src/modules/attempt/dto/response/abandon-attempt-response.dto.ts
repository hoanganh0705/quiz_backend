import { ApiProperty } from '@nestjs/swagger';
import { AttemptStatusEnum } from '../../types/attempt.types';

export class AbandonAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'Final status',
    enum: AttemptStatusEnum,
    example: AttemptStatusEnum.Abandoned,
  })
  status!: AttemptStatusEnum;

  @ApiProperty({
    description: 'Abandonment timestamp (ISO 8601)',
    example: '2025-06-01T12:30:00.000Z',
  })
  finishedAt!: string;

  @ApiProperty({ description: 'Status message', example: 'Attempt abandoned successfully' })
  message!: string;
}
