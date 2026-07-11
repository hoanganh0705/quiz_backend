import { ApiProperty } from '@nestjs/swagger';

/**
 * JSON shape emitted by `InstanceDomainExceptionFilter` for any
 * `InstanceDomainError` (404 / 400 / 403 / 409). Distinct from the RFC 7807
 * `ProblemDetailDto` emitted by `GlobalExceptionFilter` for validation,
 * ParseUUIDPipe, throttler, and JWT failures.
 */
export class InstanceDomainErrorDto {
  @ApiProperty({
    description: 'HTTP status code produced by the instance domain exception filter',
    example: 404,
  })
  statusCode!: number;

  @ApiProperty({
    description:
      'Human-readable message produced by the instance domain exception filter. ' +
      'Note: the filter rewrites the original error message into a generic one ' +
      '(e.g. "Resource not found", "Invalid request data") so client messages are ' +
      'always one of these fixed strings.',
    example: 'Resource not found',
  })
  message!: string;

  @ApiProperty({
    description: 'HTTP status text produced by the instance domain exception filter',
    example: 'Not Found',
  })
  error!: string;
}
