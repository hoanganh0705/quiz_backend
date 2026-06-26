import { ApiProperty } from '@nestjs/swagger';

export class CreateInstanceResponseDto {
  @ApiProperty({
    description: 'New instance identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Instance creation result',
    example: 'Instance created successfully',
  })
  message!: string;
}

export class JoinInstanceResponseDto {
  @ApiProperty({ description: 'Join result', example: 'Successfully joined the instance' })
  message!: string;
}

export class StartInstanceResponseDto {
  @ApiProperty({ description: 'Start result', example: 'Instance started. Players can now begin.' })
  message!: string;
}

export class CloseInstanceResponseDto {
  @ApiProperty({ description: 'Close result', example: 'Instance closed' })
  message!: string;
}
