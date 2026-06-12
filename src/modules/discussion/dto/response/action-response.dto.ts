import { ApiProperty } from '@nestjs/swagger';

export class ActionResponseDto {
  @ApiProperty({
    description: 'Confirmation message describing the result of the action',
    example: 'Operation completed successfully',
  })
  message!: string;
}
