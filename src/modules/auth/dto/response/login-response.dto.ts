import { TokenResponseDto } from './token-response.dto';

export class LoginResponseDto {
  userId!: string;
  username!: string;
  email!: string;
  token!: TokenResponseDto;
}
