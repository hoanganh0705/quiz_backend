import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '@/common/types/user-role.type';

export class CurrentUserResponseDto {
  @ApiProperty({
    description: 'Unique user identifier (UUIDv7)',
    example: '019f5e13-1fca-76c3-b5a6-6215aec50db1',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'alice_wonder' })
  username!: string;

  @ApiProperty({ description: 'Email address', example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ description: 'User role', example: 'user' })
  role!: UserRole;

  @ApiProperty({ description: 'Whether the email has been verified', example: true })
  isVerified!: boolean;
}
