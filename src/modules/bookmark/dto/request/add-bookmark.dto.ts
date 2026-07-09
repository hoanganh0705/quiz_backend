import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddBookmarkDto {
  @ApiProperty({
    description: 'UUID of the quiz to bookmark',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  quizId!: string;

  @ApiPropertyOptional({
    description: 'Personal notes about the quiz',
    type: String,
    nullable: true,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
