import { ApiProperty } from '@nestjs/swagger';

export class VerifyPasswordResponseDto {
  @ApiProperty({ description: 'Whether the provided password is valid', example: true })
  valid!: boolean;
}
