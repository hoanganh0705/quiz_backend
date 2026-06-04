import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '@/common/types/user-role.type';

export class CurrentUserResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
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
