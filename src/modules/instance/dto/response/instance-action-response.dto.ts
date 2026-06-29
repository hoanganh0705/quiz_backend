import { ApiProperty } from '@nestjs/swagger';

export class CreateInstanceResponseDto {
  @ApiProperty({
    description: 'New instance identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Human-readable confirmation message',
    example: 'Instance created successfully',
  })
  message!: string;
}

export class JoinInstanceResponseDto {
  @ApiProperty({
    description: 'Human-readable confirmation message returned by the join handler',
    example: 'Joined the instance successfully',
  })
  message!: string;
}

export class StartInstanceResponseDto {
  @ApiProperty({
    description: 'Human-readable confirmation message returned by the start handler',
    example: 'Instance started',
  })
  message!: string;
}

export class CloseInstanceResponseDto {
  @ApiProperty({
    description: 'Human-readable confirmation message returned by the close handler',
    example: 'Instance closed',
  })
  message!: string;
}
