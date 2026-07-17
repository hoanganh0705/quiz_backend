import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BlockUserDto {
  @ApiPropertyOptional({
    description: 'Reason for blocking the user',
    example: 'Harassment or inappropriate behavior',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
