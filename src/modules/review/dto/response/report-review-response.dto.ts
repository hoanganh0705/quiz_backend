import { ApiProperty } from '@nestjs/swagger';

export class ReportReviewResponseDto {
  @ApiProperty({
    description: 'Review report operation result',
    example: 'Review reported successfully',
  })
  message!: string;
}
