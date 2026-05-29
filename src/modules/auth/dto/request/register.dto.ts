import { IsEmail, IsString, Length, MaxLength, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Unique username (letters, numbers, periods, underscores, hyphens)',
    minLength: 3,
    maxLength: 50,
    pattern: '^[a-zA-Z0-9._-]+$',
    example: 'alice_wonder',
  })
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Username can only contain letters, numbers, periods, underscores, and hyphens.',
  })
  username!: string;

  @ApiProperty({
    description: 'Valid email address',
    maxLength: 255,
    format: 'email',
    example: 'alice@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description:
      'Password: minimum 6 characters, must contain 1 uppercase letter, 1 number, 1 special character',
    minLength: 6,
    maxLength: 100,
    example: 'Str0ng!Pass',
    writeOnly: true,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must contain at least 1 uppercase letter, 1 number, and 1 special character',
  })
  password!: string;
}
