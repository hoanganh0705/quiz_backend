import { ApiProperty } from '@nestjs/swagger';

/**
 * Error response body emitted by `ReviewDomainExceptionFilter` for review-domain
 * exceptions (404 review not found, 403 review permission denied, 409 review
 * conflict, 400 review validation, etc.).
 *
 * The global exception filter emits RFC 7807 ProblemDetail responses for
 * non-domain errors (401, 500), so this DTO is only used in the
 * domain-error response decorators defined in each review controller.
 */
export class ReviewDomainErrorDto {
  @ApiProperty({
    description: 'HTTP status code produced by the review domain exception filter',
    example: 404,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Human-readable message produced by the review domain exception filter',
    example: 'Review not found',
  })
  message!: string;

  @ApiProperty({
    description: 'HTTP status text produced by the review domain exception filter',
    example: 'Not Found',
  })
  error!: string;
}
