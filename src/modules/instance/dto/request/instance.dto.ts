import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInstanceDto {
  @ApiProperty({
    description: 'UUID of the published quiz version to host',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  quizVersionId!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of players (2–100, defaults to unlimited)',
    minimum: 2,
    maximum: 100,
    default: null,
    example: 10,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  maxPlayers?: number;
}
