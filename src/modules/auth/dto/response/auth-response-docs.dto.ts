import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '@/common/types/user-role.type';

// ─── Auth documentation-only wrapper DTOs ──────────────────────────────────────────
//
// These DTOs document the actual runtime response shape produced by
// ResponseFormatInterceptor, which wraps all non-paginated responses as:
//   { data: <raw_response>, meta: { timestamp: string } }
//
// The controller continues returning raw DTOs (RegisterResponseDto, LoginResponseDto, etc.)
// as method return types. These wrapper DTOs are used ONLY in @ApiOkResponse /
// @ApiCreatedResponse decorators to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Nested data types (explicit schemas for data fields) ───────────────────────

class MessageDataDto {
  @ApiProperty({
    description: 'Confirmation message',
    example: 'Registration successful. Please check your email to verify your account.',
  })
  message!: string;
}

class AvailableDataDto {
  @ApiProperty({ description: 'Whether the value is available', example: true })
  available!: boolean;
}

class ValidDataDto {
  @ApiProperty({ description: 'Whether the value is valid', example: true })
  valid!: boolean;
}

class AccessTokenDataDto {
  @ApiProperty({
    description: 'JWT access token for authenticated requests',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTIxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJyb2xlIjoidXNlciIsImlhdCI6MTcwOTAwMDAwMCwiZXhwIjoxNzA5MDAwNjAwfQ.sig',
  })
  accessToken!: string;
}

class LoginDataDto {
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
    description: 'Current session identifier',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  sessionId!: string;
}

class CurrentUserDataDto {
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

class SecurityDataDto {
  @ApiProperty({ description: 'Whether the account email is verified', example: true })
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

class SessionItemDto {
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

class MetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

// ─── Wrapper DTOs (top-level envelope) ────────────────────────────────────────

/**
 * Runtime shape: { data: { message: string }, meta: { timestamp: string } }
 * Used for: register, logout, verify-email, verify-password, forgot-password, reset-password,
 * change-password, delete-account, session-management result
 */
export class AuthWrappedMessageDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => MessageDataDto })
  data!: MessageDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: { available: boolean }, meta: { timestamp: string } }
 * Used for: check-email, check-username
 */
export class AuthWrappedAvailableDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => AvailableDataDto })
  data!: AvailableDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: { valid: boolean }, meta: { timestamp: string } }
 * Used for: verify-password
 */
export class AuthWrappedValidDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => ValidDataDto })
  data!: ValidDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: { accessToken: string }, meta: { timestamp: string } }
 * Used for: refresh-token
 */
export class AuthWrappedAccessTokenDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => AccessTokenDataDto })
  data!: AccessTokenDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: { userId, username, email, accessToken, sessionId }, meta: { timestamp: string } }
 * Used for: login, googleLogin
 */
export class AuthWrappedLoginDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => LoginDataDto })
  data!: LoginDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: { userId, username, email, role, isVerified }, meta: { timestamp: string } }
 * Used for: getCurrentUser (/auth/me)
 */
export class AuthWrappedCurrentUserDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => CurrentUserDataDto })
  data!: CurrentUserDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: { emailVerified, activeSessionCount, lastSuccessfulLoginAt, lastPasswordChangeAt }, meta: { timestamp: string } }
 * Used for: getSecurityDashboard (/auth/security/dashboard)
 */
export class AuthWrappedSecurityDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => SecurityDataDto })
  data!: SecurityDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: SessionItemDto[], meta: { timestamp: string } }
 * Used for: getActiveSessions (/auth/sessions)
 */
export class AuthWrappedSessionListDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    isArray: true,
    type: () => SessionItemDto,
  })
  data!: SessionItemDto[];

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}
