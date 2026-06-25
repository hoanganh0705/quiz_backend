import { ApiProperty } from '@nestjs/swagger';

/**
 * Runtime shape: { data: { message: string }, meta: { timestamp: string } }
 * Produced by ResponseFormatInterceptor for all non-paginated responses.
 */
export class WrappedMessageResponseDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    example: {
      message: 'Registration successful. Please check your email to verify your account.',
    },
  })
  data!: { message: string };

  @ApiProperty({
    description: 'Response metadata',
    example: { timestamp: '2026-06-25T10:30:00.000Z' },
  })
  meta!: { timestamp: string };
}
