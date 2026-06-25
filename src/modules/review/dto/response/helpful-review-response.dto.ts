import { ApiProperty } from '@nestjs/swagger';

export class HelpfulReviewResponseDto {
  @ApiProperty({
    description: 'Helpful vote operation result',
    example: 'Review marked as helpful',
  })
  message!: string;
}
