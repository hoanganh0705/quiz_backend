import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationDto {
  @ApiProperty({
    description: 'Email address that was used during registration',
    maxLength: 255,
    format: 'email',
    example: 'alice@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
