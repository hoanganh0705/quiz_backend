import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: 'Confirmation message',
    example: 'If the account exists, a password reset email has been sent.',
  })
  message!: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({
    description: 'Confirmation message',
    example: 'Password has been reset successfully. Please log in with your new password.',
  })
  message!: string;
}
