import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { USER_PAGINATION_DEFAULT_LIMIT } from '../../domain/constants/user.domain-constants';

export class ListUserActivityQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwWiIsImV2ZW50SWQiOiJ1dWlkIn0',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1-100)',
    minimum: 1,
    maximum: 100,
    default: USER_PAGINATION_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = USER_PAGINATION_DEFAULT_LIMIT;
}
