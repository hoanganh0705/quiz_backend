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
    description: 'Last activity timestamp (PostgreSQL timestamptz: `YYYY-MM-DD HH:MM:SS.us+00`)',
    example: '2026-07-14 01:53:39.812376+00',
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
