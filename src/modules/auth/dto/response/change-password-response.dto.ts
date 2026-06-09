import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordResponseDto {
  @ApiProperty({
    description: 'Change password confirmation',
    example: 'Password changed successfully. All other sessions have been logged out.',
  })
  message!: string;
}
