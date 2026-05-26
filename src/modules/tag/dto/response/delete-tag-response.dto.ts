import { ApiProperty } from '@nestjs/swagger';

export class DeleteTagResponseDto {
  @ApiProperty({ description: 'Deletion confirmation', example: 'Tag deleted successfully' })
  message!: string;
}
