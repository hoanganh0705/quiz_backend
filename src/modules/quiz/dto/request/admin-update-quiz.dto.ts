import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUpdateQuizDto {
  @ApiPropertyOptional({
    description: 'Whether the quiz is featured on the home page',
    default: false,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the quiz is hidden from public listings',
    default: false,
    example: false,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}
