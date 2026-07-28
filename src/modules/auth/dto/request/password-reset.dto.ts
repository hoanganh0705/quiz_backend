import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import {
  NEW_PASSWORD_MAX,
  NEW_PASSWORD_MAX_MESSAGE,
  NEW_PASSWORD_MESSAGE,
  NEW_PASSWORD_MIN,
  NEW_PASSWORD_MIN_MESSAGE,
  NEW_PASSWORD_REGEX,
} from './new-password.dto';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Registered email address',
    example: 'alice@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token (64-character hex string from the password-reset email)',
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    minLength: 32,
    maxLength: 128,
  })
  @IsString()
  @MinLength(32, { message: 'Invalid reset token' })
  @MaxLength(128)
  token!: string;

  @ApiProperty({
    description: 'New password (shared policy: see RegisterDto for full requirements)',
    minLength: NEW_PASSWORD_MIN,
    maxLength: NEW_PASSWORD_MAX,
    example: 'NewSecurePassword123',
  })
  @IsString()
  @MinLength(NEW_PASSWORD_MIN, { message: NEW_PASSWORD_MIN_MESSAGE })
  @MaxLength(NEW_PASSWORD_MAX, { message: NEW_PASSWORD_MAX_MESSAGE })
  @Matches(NEW_PASSWORD_REGEX, { message: NEW_PASSWORD_MESSAGE })
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({
    description: 'New password (shared policy: see RegisterDto for full requirements)',
    minLength: NEW_PASSWORD_MIN,
    maxLength: NEW_PASSWORD_MAX,
    example: 'NewSecurePassword123',
  })
  @IsString()
  @MinLength(NEW_PASSWORD_MIN, { message: NEW_PASSWORD_MIN_MESSAGE })
  @MaxLength(NEW_PASSWORD_MAX, { message: NEW_PASSWORD_MAX_MESSAGE })
  @Matches(NEW_PASSWORD_REGEX, { message: NEW_PASSWORD_MESSAGE })
  newPassword!: string;
}
