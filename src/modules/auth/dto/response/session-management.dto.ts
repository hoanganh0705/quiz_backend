import { ApiProperty } from '@nestjs/swagger';

export class SessionListItemDto {
  @ApiProperty({ description: 'Unique session identifier' })
  sessionId!: string;

  @ApiProperty({ description: 'Browser name', type: String, nullable: true })
  deviceBrowser!: string | null;

  @ApiProperty({ description: 'Operating system', type: String, nullable: true })
  deviceOs!: string | null;

  @ApiProperty({ description: 'Device type (desktop, mobile, tablet, unknown)' })
  deviceType!: string;

  @ApiProperty({ description: 'IP address', type: String, nullable: true })
  ipAddress!: string | null;

  @ApiProperty({
    description: 'Last activity timestamp (ISO 8601)',
    example: '2026-06-03T10:00:00.000Z',
  })
  lastActiveAt!: string;

  @ApiProperty({ description: 'Whether this is the current session' })
  isCurrentSession!: boolean;
}

export class SessionListResponseDto {
  @ApiProperty({ description: 'List of active sessions', type: [SessionListItemDto] })
  sessions!: SessionListItemDto[];
}

export class SessionManagementResultDto {
  @ApiProperty({ description: 'Operation result message' })
  message!: string;
}

export class AccountSecurityDto {
  @ApiProperty({ description: 'Whether the account email is verified' })
  emailVerified!: boolean;

  @ApiProperty({ description: 'Number of currently active sessions', example: 3 })
  activeSessionCount!: number;

  @ApiProperty({
    description: 'Timestamp of the last successful login',
    type: String,
    nullable: true,
    example: '2026-06-03T10:00:00.000Z',
  })
  lastSuccessfulLoginAt!: string | null;

  @ApiProperty({
    description: 'Timestamp of the last password change',
    type: String,
    nullable: true,
    example: '2026-06-03T10:00:00.000Z',
  })
  lastPasswordChangeAt!: string | null;
}
