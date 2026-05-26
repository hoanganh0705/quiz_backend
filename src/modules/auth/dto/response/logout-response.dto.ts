import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Logout confirmation',
    example: 'Successfully logged out. Refresh cookie cleared.',
  })
  message!: string;
}
