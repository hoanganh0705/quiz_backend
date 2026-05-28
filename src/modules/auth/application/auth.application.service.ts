import { Injectable } from '@nestjs/common';
import type { SessionRequestContext } from '../types/auth-context.types';
import { AuthLoginService } from '../domain/auth-login.service';
import { AuthRefreshService } from '../domain/auth-refresh.service';
import { AuthRegistrationService } from '../domain/auth-registration.service';
import type {
  LoginCommand,
  RegisterCommand,
  ResendVerificationEmailCommand,
  VerifyEmailCommand,
} from '../domain/types/auth-commands';
import { LoginResponseDto } from '../dto/response/login-response.dto';
import { RefreshTokenResponseDto } from '../dto/response/refresh-token-response.dto';
import { LogoutResponseDto } from '../dto/response/logout-response.dto';
import { RegisterResponseDto } from '../dto/response/register-response.dto';
import { VerifyEmailResponseDto } from '../dto/response/verify-email-response.dto';
import { AuthResponseMapper } from '../mappers/auth-response.mapper';

type LoginApplicationResult = {
  response: LoginResponseDto;
  refreshToken: string;
};

type RefreshTokenApplicationResult = {
  response: RefreshTokenResponseDto;
  refreshToken: string;
};

@Injectable()
export class AuthApplicationService {
  constructor(
    private readonly authRegistrationService: AuthRegistrationService,
    private readonly authLoginService: AuthLoginService,
    private readonly authRefreshService: AuthRefreshService,
    private readonly authResponseMapper: AuthResponseMapper,
  ) {}

  async register(registerCommand: RegisterCommand): Promise<RegisterResponseDto> {
    const result = await this.authRegistrationService.register(registerCommand);
    return this.authResponseMapper.toRegisterResponse(result);
  }

  async verifyEmail(verifyEmailCommand: VerifyEmailCommand): Promise<VerifyEmailResponseDto> {
    const result = await this.authRegistrationService.verifyEmail(verifyEmailCommand);
    return this.authResponseMapper.toVerifyEmailResponse(result);
  }

  async resendVerificationEmail(
    resendVerificationCommand: ResendVerificationEmailCommand,
  ): Promise<VerifyEmailResponseDto> {
    const result =
      await this.authRegistrationService.resendVerificationEmail(resendVerificationCommand);
    return this.authResponseMapper.toVerifyEmailResponse(result);
  }

  async login(
    loginCommand: LoginCommand,
    session: SessionRequestContext,
  ): Promise<LoginApplicationResult> {
    const result = await this.authLoginService.login(loginCommand, session);
    return {
      response: this.authResponseMapper.toLoginResponse(result),
      refreshToken: result.refreshToken,
    };
  }

  async refreshToken(
    refreshToken: string,
    session: SessionRequestContext,
  ): Promise<RefreshTokenApplicationResult> {
    const result = await this.authRefreshService.refreshToken(refreshToken, session);
    return {
      response: this.authResponseMapper.toRefreshTokenResponse(result),
      refreshToken: result.refreshToken,
    };
  }

  async logout(refreshToken: string | null): Promise<LogoutResponseDto> {
    if (refreshToken) {
      await this.authRefreshService.logout(refreshToken);
    }

    return this.authResponseMapper.toLogoutResponse('Logged out successfully');
  }

  async logoutAll(userId: string): Promise<LogoutResponseDto> {
    await this.authRefreshService.logoutAll(userId);
    return this.authResponseMapper.toLogoutResponse('Logged out from all sessions successfully');
  }
}
