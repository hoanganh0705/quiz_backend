import { ApiProperty } from '@nestjs/swagger';

export class DeleteReviewResponseDto {
  @ApiProperty({
    description: 'Deletion confirmation',
    example: 'Review deleted successfully',
  })
  message!: string;
}
