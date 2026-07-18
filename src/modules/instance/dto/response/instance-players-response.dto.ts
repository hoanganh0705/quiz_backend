import { ApiProperty } from '@nestjs/swagger';
import { InstancePlayerResponseDto } from './instance-player-response.dto';

export class InstancePlayersResponseDto {
  @ApiProperty({
    description: 'Parent instance identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Players in the instance',
    type: () => [InstancePlayerResponseDto],
  })
  items!: InstancePlayerResponseDto[];

  @ApiProperty({ description: 'Total number of players', example: 8 })
  total!: number;
}
