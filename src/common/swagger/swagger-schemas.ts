import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '../types/user-role.type';

export class PaginationMetaDto {
  @ApiProperty({ description: 'Number of items returned in this page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description:
      'Opaque cursor string for fetching the next page. `null` when there is no next page.',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNDQifQ',
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;
}

export class ErrorResponseDto {
  @ApiProperty({ description: 'Machine-readable error code', example: 'UNAUTHORIZED' })
  statusCode!: number;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'Invalid or expired access token',
  })
  message!: string;

  @ApiProperty({ description: 'Short error code', example: 'UNAUTHORIZED' })
  error!: string;
}

export class UnauthorizedErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({ example: 401 })
  declare statusCode: number;

  @ApiProperty({ example: 'Invalid or expired access token' })
  declare message: string;

  @ApiProperty({ example: 'Unauthorized' })
  declare error: string;
}

export class ForbiddenErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({ example: 403 })
  declare statusCode: number;

  @ApiProperty({ example: 'You do not have permission to perform this action' })
  declare message: string;

  @ApiProperty({ example: 'Forbidden' })
  declare error: string;
}

export class NotFoundErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({ example: 404 })
  declare statusCode: number;

  @ApiProperty({ example: 'The requested resource was not found' })
  declare message: string;

  @ApiProperty({ example: 'Not Found' })
  declare error: string;
}

export class ValidationErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    description: 'Validation error messages',
    example: ['email must be an email', 'password must be longer than 5 characters'],
    type: [String],
  })
  message!: string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}

export class CursorQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor string from a previous response for cursor-based pagination',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNDQifQ',
    nullable: true,
  })
  cursor?: string | null;
}

export class LimitQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of items to return per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  limit?: number | null;
}

export class UserRoleEnumDto {
  @ApiProperty({ description: 'User role', enum: ['admin', 'moderator', 'user'], example: 'user' })
  role!: UserRole;
}
