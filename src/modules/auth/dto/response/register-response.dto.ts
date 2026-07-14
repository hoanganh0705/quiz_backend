import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({
    description:
      'Generic acknowledgement message (same for new account, duplicate email, duplicate username)',
    example: 'If your registration can be completed, a verification email will be sent.',
  })
  message!: string;
}
