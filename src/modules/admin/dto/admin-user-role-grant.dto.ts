import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminUserRoleGrantDto {
  @ApiProperty({ description: 'Role or permission identifier (e.g. "admin", "moderator", or permission key)', example: 'moderator' })
  @IsString()
  @IsNotEmpty()
  role!: string;
}

export class AdminUserRoleResponseDto {
  @ApiProperty({ description: 'Target user UUID', format: 'uuid' })
  readonly userId!: string;

  @ApiProperty({ description: 'Assigned role or permission' })
  readonly role!: string;

  @ApiProperty({ description: 'Timestamp when role was assigned (ISO 8601)' })
  readonly grantedAt!: string;
}

export class AdminUserRoleItemDto {
  @ApiProperty({ description: 'Role name or permission identifier' })
  readonly role!: string;

  @ApiProperty({ description: 'Timestamp when role was assigned (ISO 8601)' })
  readonly grantedAt!: string;
}
