import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({
    description:
      'Logout confirmation. The exact message varies by endpoint: ' +
      '`POST /auth/logout` returns "Logged out successfully"; ' +
      '`POST /auth/logout-all` returns "Logged out from all sessions successfully".',
    examples: {
      singleLogout: {
        summary: 'POST /auth/logout',
        value: 'Logged out successfully',
      },
      logoutAll: {
        summary: 'POST /auth/logout-all',
        value: 'Logged out from all sessions successfully',
      },
    },
  })
  message!: string;
}
