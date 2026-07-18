import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockedUserDto {
  @ApiProperty({
    description: 'Identifier of the blocked user',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  blockedId!: string;

  @ApiPropertyOptional({
    description: 'Reason provided when blocking',
    example: 'Harassment',
    nullable: true,
  })
  reason!: string | null;
}
