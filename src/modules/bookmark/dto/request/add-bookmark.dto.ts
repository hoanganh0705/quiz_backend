import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddBookmarkDto {
  @ApiProperty({
    description: 'UUID of the quiz to bookmark',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @IsUUID('7')
  quizId!: string;

  @ApiPropertyOptional({
    description: 'Personal notes about the quiz',
    type: String,
    nullable: true,
    maxLength: 500,
    example: 'Personal note about this quiz',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
