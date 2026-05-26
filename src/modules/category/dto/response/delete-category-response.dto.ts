import { ApiProperty } from '@nestjs/swagger';

export class DeleteCategoryResponseDto {
  @ApiProperty({ description: 'Deletion confirmation', example: 'Category deleted successfully' })
  message!: string;
}
