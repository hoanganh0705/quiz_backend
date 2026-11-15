import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class AdminUpdateUserRoleDto {
  @ApiProperty({ description: 'New system role', enum: ['user', 'moderator', 'admin'], example: 'moderator' })
  @IsEnum(['user', 'moderator', 'admin'])
  role!: 'user' | 'moderator' | 'admin';
}
