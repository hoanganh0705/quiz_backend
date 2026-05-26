import { ApiProperty } from '@nestjs/swagger';

export class DeleteQuizResponseDto {
  @ApiProperty({ description: 'Deletion confirmation', example: 'Quiz deleted successfully' })
  message!: string;
}
