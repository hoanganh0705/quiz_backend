import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Registered email address',
    example: 'alice@example.com',
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Account password',
    minLength: 6,
    maxLength: 100,
    example: 'Str0ng!Pass',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;
}
