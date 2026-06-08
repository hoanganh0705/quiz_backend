import { ApiProperty } from '@nestjs/swagger';

export class PublicDiscussionProfileResponseDto {
  @ApiProperty({ description: 'Total discussion threads created by the user', example: 42 })
  threadsCreated!: number;

  @ApiProperty({ description: 'Total discussion comments created by the user', example: 310 })
  commentsCreated!: number;

  @ApiProperty({ description: 'Total accepted answers authored by the user', example: 18 })
  acceptedAnswers!: number;

  @ApiProperty({ description: 'Aggregate reputation score from discussion activity', example: 540 })
  reputation!: number;
}
