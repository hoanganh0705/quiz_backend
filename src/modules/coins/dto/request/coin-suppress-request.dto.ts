import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CoinSuppressRequestDto {
  @ApiProperty({
    format: 'uuid',
    description:
      "Quiz to hide from the caller's Recommended rail for 30 days. Returns 404 if the quiz does not exist.",
  })
  @IsUUID()
  quizId!: string;
}
