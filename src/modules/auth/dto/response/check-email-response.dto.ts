import { ApiProperty } from '@nestjs/swagger';

export class CheckEmailResponseDto {
  @ApiProperty({ description: 'Whether the email is available for registration', example: true })
  available!: boolean;
}
