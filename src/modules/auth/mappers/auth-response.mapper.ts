import { Injectable } from '@nestjs/common';
import type {
  LoginResult,
  RefreshTokenResult,
  RegisterResult,
  VerifyEmailResult,
} from '../types/auth-result.types';
import { LoginResponseDto } from '../dto/response/login-response.dto';
import { RefreshTokenResponseDto } from '../dto/response/refresh-token-response.dto';
import { LogoutResponseDto } from '../dto/response/logout-response.dto';
import { RegisterResponseDto } from '../dto/response/register-response.dto';
import { VerifyEmailResponseDto } from '../dto/response/verify-email-response.dto';

@Injectable()
export class AuthResponseMapper {
  toLoginResponse(result: LoginResult): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.userId = result.userId;
    dto.username = result.username;
    dto.email = result.email;
    dto.accessToken = result.accessToken;
    dto.sessionId = (result as LoginResult & { sessionId?: string }).sessionId ?? '';
    return dto;
  }

  toRefreshTokenResponse(result: RefreshTokenResult): RefreshTokenResponseDto {
    const dto = new RefreshTokenResponseDto();
    dto.accessToken = result.accessToken;
    return dto;
  }

  toLogoutResponse(message: string): LogoutResponseDto {
    const dto = new LogoutResponseDto();
    dto.message = message;
    return dto;
  }

  toRegisterResponse(result: RegisterResult): RegisterResponseDto {
    const dto = new RegisterResponseDto();
    dto.message = result.message;
    return dto;
  }

  toVerifyEmailResponse(result: VerifyEmailResult): VerifyEmailResponseDto {
    const dto = new VerifyEmailResponseDto();
    dto.message = result.message;
    return dto;
  }
}
