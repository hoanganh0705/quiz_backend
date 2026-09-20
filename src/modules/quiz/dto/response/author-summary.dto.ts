import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthorSummaryDto {
  @ApiProperty({
    description: 'Opaque user identifier (UUIDv7)',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'URL-friendly handle', example: 'nestjs_dev' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Display name',
    type: String,
    example: 'NestJS Dev',
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    type: String,
    format: 'uri',
    example: 'https://example.com/avatars/nestjs_dev.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;
}
