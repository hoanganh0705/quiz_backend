import { IsEmail, IsString, Length, MaxLength, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  NEW_PASSWORD_MAX,
  NEW_PASSWORD_MAX_MESSAGE,
  NEW_PASSWORD_MESSAGE,
  NEW_PASSWORD_MIN,
  NEW_PASSWORD_MIN_MESSAGE,
  NEW_PASSWORD_REGEX,
} from './new-password.dto';

export class RegisterDto {
  @ApiProperty({
    description:
      'Username (case-insensitive; stored lowercase). Accepts letters, numbers, periods, underscores, hyphens.',
    minLength: 3,
    maxLength: 50,
    pattern: '^[a-zA-Z0-9._-]+$',
    example: 'john_doe',
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
      'Password: minimum 8 characters, must contain at least one uppercase letter, one lowercase letter, and one number',
    minLength: NEW_PASSWORD_MIN,
    maxLength: NEW_PASSWORD_MAX,
    example: 'NewSecurePassword123',
    writeOnly: true,
  })
  @IsString()
  @MinLength(NEW_PASSWORD_MIN, { message: NEW_PASSWORD_MIN_MESSAGE })
  @MaxLength(NEW_PASSWORD_MAX, { message: NEW_PASSWORD_MAX_MESSAGE })
  @Matches(NEW_PASSWORD_REGEX, { message: NEW_PASSWORD_MESSAGE })
  password!: string;
}
