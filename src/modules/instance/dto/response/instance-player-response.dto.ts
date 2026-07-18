import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  INSTANCE_PLAYER_STATUSES,
  type QuizInstancePlayerStatus,
} from '../../types/instance.types';

export class InstancePlayerResponseDto {
  @ApiProperty({
    description: 'Instance player record identifier',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  instancePlayerId!: string;

  @ApiProperty({
    description: 'Parent instance identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Player user identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Player username', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Player display name',
    type: String,
    example: 'Alice Wonder',
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Player avatar URL',
    type: String,
    format: 'uri',
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Player status in the instance',
    enum: INSTANCE_PLAYER_STATUSES,
    example: 'joined',
  })
  status!: QuizInstancePlayerStatus;

  @ApiPropertyOptional({
    description: 'Attempt identifier if player has started',
    type: String,
    format: 'uuid',
    example: '880e8400-e29b-71d4-a716-446655440000',
    nullable: true,
  })
  attemptId!: string | null;

  @ApiProperty({
    description: 'Join timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  joinedAt!: string;
}
