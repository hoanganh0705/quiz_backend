import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailResponseDto {
  @ApiProperty({
    description: 'Email verification result',
    example: 'Email verified successfully. You can now log in.',
  })
  message!: string;
}
