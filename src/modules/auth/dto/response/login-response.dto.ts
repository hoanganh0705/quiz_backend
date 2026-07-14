import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Unique user identifier (UUIDv7)',
    example: '019f5e13-1fca-798f-93cc-b5ef8699de25',
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
    description: 'Current session identifier for session management operations (UUIDv7)',
    example: '019f5e4c-b6fa-72cd-a5a5-ffe59539701d',
  })
  sessionId!: string;
}
