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

  // Login intentionally allows a 6-character minimum, while register/reset/
  // change require the new shared `NEW_PASSWORD_MIN = 8` policy. The lower
  // bound here is the "minimum we'll accept a bcrypt compare for" — bcrypt
  // itself silently truncates input above 72 bytes, so users with passwords
  // from the pre-NEW_PASSWORD_MIN era (or third-party imports) can still
  // log in as long as their stored hash is the one we compare against. The
  // class-validator floor of 6 prevents the body parser from accepting
  // empty / trivial strings; we deliberately do NOT enforce 8+ on login.
  @ApiProperty({
    description: 'Account password',
    minLength: 6,
    maxLength: 100,
    example: 'Str0ng!Pass',
    writeOnly: true,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;
}
