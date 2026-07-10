import { ApiProperty } from '@nestjs/swagger';

export const RANKING_ERROR_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'BAD_REQUEST',
  'NOT_FOUND',
  'INTERNAL_ERROR',
] as const;
export type RankingErrorCode = (typeof RANKING_ERROR_CODES)[number];

/**
 * Error envelope emitted by `RankingDomainExceptionFilter` for every HTTP error
 * originating from the ranking controller (including JWT failures, permission
 * denials, and validation errors). Distinct from RFC 7807 ProblemDetailDto.
 *
 * `RankingDomainExceptionFilter` uses `@Catch()` (catches ALL exceptions).
 * This means EVERY error from the ranking controller — including
 * `JwtGuard.UnauthorizedException`, `PermissionsGuard.ForbiddenException`,
 * and class-validator `BadRequestException` — is intercepted and re-written
 * to the same shape: `{ statusCode, message, code, timestamp }`.
 *
 * The `code` field is NOT the HTTP status text; it is a domain-specific
 * machine-readable string like `UNAUTHORIZED`, `BAD_REQUEST`. The filter
 * extracts it from `HttpException` response objects, falling back to a
 * status-based default (`BAD_REQUEST` for 400, `NOT_FOUND` for 404, etc.).
 */
export class RankingDomainErrorDto {
  @ApiProperty({
    description: 'HTTP status code produced by the ranking domain exception filter',
    example: 401,
  })
  statusCode!: number;

  @ApiProperty({
    description:
      'Human-readable message. For JwtGuard failures this is the message from ' +
      '`UnauthorizedException`. For `BadRequestException` (validation) it is the ' +
      'validation message. For PermissionsGuard failures it is the message from ' +
      '`ForbiddenException`. The message content varies by source.',
    example: 'Authorization header is missing',
  })
  message!: string;

  @ApiProperty({
    description:
      'Machine-readable error code. The filter extracts this from the exception ' +
      'response shape (`code` field). For HttpExceptions without an explicit code, ' +
      'defaults to status-based strings: `UNAUTHORIZED` (401), `FORBIDDEN` (403), ' +
      '`BAD_REQUEST` (400), `NOT_FOUND` (404), `INTERNAL_ERROR` (500).',
    enum: RANKING_ERROR_CODES,
    example: 'UNAUTHORIZED',
  })
  code!: RankingErrorCode;

  @ApiProperty({
    description: 'ISO 8601 timestamp of when the error was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}
