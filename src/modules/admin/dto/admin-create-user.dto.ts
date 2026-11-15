import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminCreateUserDto {
  @ApiProperty({ description: 'Unique username', minLength: 3, maxLength: 50, example: 'new_admin_user' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Initial account password', minLength: 8, example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ description: 'Public display name', maxLength: 100, example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: 'System role assignment', enum: ['user', 'moderator', 'admin'], default: 'user' })
  @IsOptional()
  @IsEnum(['user', 'moderator', 'admin'])
  role?: 'user' | 'moderator' | 'admin' = 'user';

  @ApiPropertyOptional({ description: 'Pre-verify email', default: true })
  @IsOptional()
  isVerified?: boolean = true;
}
