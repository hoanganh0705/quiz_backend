import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({
    description: 'UUID of the question being answered',
    type: String,
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({
    description: 'UUID of the selected answer option. Omit or send `null` to skip this question.',
    type: String,
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  selectedOptionId?: string | null;

  @ApiPropertyOptional({
    description: 'Time taken to answer in milliseconds',
    type: Number,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  timeTakenMs?: number | null;
}
