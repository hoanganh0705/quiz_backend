import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountResponseDto {
  @ApiProperty({ description: 'Operation result message', example: 'Account deleted successfully' })
  message!: string;
}
