import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class CheckEmailDto {
  @ApiProperty({
    description: 'Email address to check for availability',
    format: 'email',
    maxLength: 255,
    example: 'alice@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  email!: string;
}
