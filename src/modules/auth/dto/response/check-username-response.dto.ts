import { ApiProperty } from '@nestjs/swagger';

export class CheckUsernameResponseDto {
  @ApiProperty({ description: 'Whether the username is available for registration', example: true })
  available!: boolean;
}
