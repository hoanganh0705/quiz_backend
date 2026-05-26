import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({
    description: 'Confirmation message',
    example: 'Registration successful. Please check your email to verify your account.',
  })
  message!: string;
}
