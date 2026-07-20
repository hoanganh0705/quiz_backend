import { ApiProperty } from '@nestjs/swagger';

export class HelpfulReviewResponseDto {
  @ApiProperty({
    description:
      'Helpful vote operation result. The endpoint is idempotent at the response surface: ' +
      'a retry sees the same message regardless of whether state changed.',
    example: 'Helpful vote recorded',
  })
  message!: string;
}
