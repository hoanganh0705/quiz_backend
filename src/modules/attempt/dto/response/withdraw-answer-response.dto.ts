import { ApiProperty } from '@nestjs/swagger';

export class WithdrawAnswerResponseDto {
  @ApiProperty({
    description: 'Question identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440001',
  })
  questionId!: string;

  @ApiProperty({
    description: 'Withdrawal timestamp (ISO 8601)',
    example: '2025-06-01T12:20:00.000Z',
  })
  withdrawnAt!: string;
}
