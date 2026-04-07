import { TokenResponseDto } from './token-response.dto';

export class RegisterResponseDto {
  userId!: string;
  username!: string;
  email!: string;
  createdAt!: string;
  token!: TokenResponseDto;
}
