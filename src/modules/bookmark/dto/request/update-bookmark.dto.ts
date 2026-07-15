import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBookmarkDto {
  @ApiPropertyOptional({
    description: 'Updated personal notes about the quiz',
    type: String,
    nullable: true,
    maxLength: 500,
    example: 'Revised personal note for this quiz',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
