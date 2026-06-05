import { ApiProperty } from '@nestjs/swagger';

export class CategoryFollowMessageResponseDto {
  @ApiProperty({ example: 'Category followed successfully' })
  message!: string;
}
