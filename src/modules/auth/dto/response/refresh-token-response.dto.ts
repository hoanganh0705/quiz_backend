import { ApiProperty } from '@nestjs/swagger';
import { TokenResponseDto } from './token-response.dto';

export class RefreshTokenResponseDto {
  @ApiProperty({ description: 'New JWT access token', type: () => TokenResponseDto })
  token!: TokenResponseDto;
}
