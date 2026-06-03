import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    description: 'JWT access token for authenticated requests',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTIxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJyb2xlIjoidXNlciIsImlhdCI6MTcwOTAwMDAwMCwiZXhwIjoxNzA5MDAwNjAwfQ.sig',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Current session identifier for session management operations',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  sessionId!: string;
}
