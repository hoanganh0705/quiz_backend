import { Injectable } from '@nestjs/common';
import type { AuthRequestContext } from '../types/auth-context.types';
import { AuthService } from '../domain/auth.service';
import { LoginDto } from '../dto/request/login.dto';
import { RegisterDto } from '../dto/request/register.dto';
import { VerifyEmailDto } from '../dto/request/verify-email.dto';
import { ResendVerificationDto } from '../dto/request/resend-verification.dto';
import { LoginResponseDto } from '../dto/response/login-response.dto';
import { RefreshTokenResponseDto } from '../dto/response/refresh-token-response.dto';
import { LogoutResponseDto } from '../dto/response/logout-response.dto';
import { RegisterResponseDto } from '../dto/response/register-response.dto';
import { VerifyEmailResponseDto } from '../dto/response/verify-email-response.dto';
import { AuthResponseMapper } from '../mappers/auth-response.mapper';

@Injectable()
export class AuthApplicationService {
  constructor(
    private readonly authService: AuthService,
    private readonly authResponseMapper: AuthResponseMapper,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponseDto> {
    const result = await this.authService.register(registerDto);
    return this.authResponseMapper.toRegisterResponse(result);
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    const result = await this.authService.verifyEmail(verifyEmailDto.token);
    return this.authResponseMapper.toVerifyEmailResponse(result);
  }

  async resendVerificationEmail(
    resendVerificationDto: ResendVerificationDto,
  ): Promise<VerifyEmailResponseDto> {
    const result = await this.authService.resendVerificationEmail(resendVerificationDto.email);
    return this.authResponseMapper.toVerifyEmailResponse(result);
  }

  async login(loginDto: LoginDto, context: AuthRequestContext): Promise<LoginResponseDto> {
    const result = await this.authService.login(loginDto, context.session);
    context.setRefreshToken(result.refreshToken);
    return this.authResponseMapper.toLoginResponse(result);
  }

  async refreshToken(
    refreshToken: string,
    context: AuthRequestContext,
  ): Promise<RefreshTokenResponseDto> {
    const result = await this.authService.refreshToken(refreshToken, context.session);
    context.setRefreshToken(result.refreshToken);
    return this.authResponseMapper.toRefreshTokenResponse(result);
  }

  async logout(
    refreshToken: string | null,
    context: AuthRequestContext,
  ): Promise<LogoutResponseDto> {
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    context.clearRefreshToken();
    return this.authResponseMapper.toLogoutResponse('Logged out successfully');
  }

  async logoutAll(userId: string, context: AuthRequestContext): Promise<LogoutResponseDto> {
    await this.authService.logoutAll(userId);
    context.clearRefreshToken();
    return this.authResponseMapper.toLogoutResponse('Logged out from all sessions successfully');
  }
}
