import { ApiProperty } from '@nestjs/swagger';
import { TokenResponseDto } from './token-response.dto';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'alice_wonder' })
  username!: string;

  @ApiProperty({ description: 'Email address', example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ description: 'JWT access token', type: () => TokenResponseDto })
  token!: TokenResponseDto;
}
