import { Injectable } from '@nestjs/common';
import type { SessionRequestContext } from '../types/auth-context.types';
import { AuthLoginService } from '../domain/auth-login.service';
import { AuthRefreshService } from '../domain/auth-refresh.service';
import { AuthRegistrationService } from '../domain/auth-registration.service';
import { PasswordResetService } from '../domain/password-reset.service';
import { ChangePasswordService } from '../domain/change-password.service';
import { SessionManagementService } from '../domain/session-management.service';
import type {
  LoginCommand,
  RegisterCommand,
  ResendVerificationEmailCommand,
  VerifyEmailCommand,
  ForgotPasswordCommand,
  ResetPasswordCommand,
  ChangePasswordCommand,
  RevokeSessionCommand,
  LogoutOtherSessionsCommand,
} from '../domain/types/auth-commands';
import { LoginResponseDto } from '../dto/response/login-response.dto';
import { RefreshTokenResponseDto } from '../dto/response/refresh-token-response.dto';
import { LogoutResponseDto } from '../dto/response/logout-response.dto';
import { RegisterResponseDto } from '../dto/response/register-response.dto';
import { VerifyEmailResponseDto } from '../dto/response/verify-email-response.dto';
import {
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
} from '../dto/response/password-reset.dto';
import {
  SessionListResponseDto,
  SecurityDashboardDto,
  SessionManagementResultDto,
} from '../dto/response/session-management.dto';
import { AuthResponseMapper } from '../mappers/auth-response.mapper';

type LoginApplicationResult = {
  response: LoginResponseDto;
  refreshToken: string;
  sessionId: string;
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
    private readonly passwordResetService: PasswordResetService,
    private readonly changePasswordService: ChangePasswordService,
    private readonly sessionManagementService: SessionManagementService,
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
      sessionId: result.sessionId,
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

  async forgotPassword(
    forgotPasswordCommand: ForgotPasswordCommand,
  ): Promise<ForgotPasswordResponseDto> {
    const result = await this.passwordResetService.requestPasswordReset(
      forgotPasswordCommand.email,
    );
    return { message: result.message };
  }

  async resetPassword(
    resetPasswordCommand: ResetPasswordCommand,
  ): Promise<ResetPasswordResponseDto> {
    const result = await this.passwordResetService.resetPassword(
      resetPasswordCommand.token,
      resetPasswordCommand.newPassword,
    );
    return { message: result.message };
  }

  async changePassword(
    changePasswordCommand: ChangePasswordCommand,
    currentSessionId: string,
  ): Promise<LogoutResponseDto> {
    const result = await this.changePasswordService.changePassword(
      changePasswordCommand.userId,
      changePasswordCommand.currentPassword,
      changePasswordCommand.newPassword,
      currentSessionId,
    );
    return this.authResponseMapper.toLogoutResponse(result.message);
  }

  async getActiveSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionListResponseDto> {
    const sessions = await this.sessionManagementService.getActiveSessions(
      userId,
      currentSessionId,
    );
    return {
      sessions: sessions.map((session) => ({
        sessionId: session.sessionId,
        deviceBrowser: session.deviceBrowser,
        deviceOs: session.deviceOs,
        deviceType: session.deviceType,
        ipAddress: session.ipAddress,
        lastActiveAt: session.lastActiveAt,
        isCurrentSession: session.sessionId === currentSessionId,
      })),
    };
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId: string,
  ): Promise<SessionManagementResultDto> {
    await this.sessionManagementService.revokeSession(userId, sessionId, currentSessionId);
    return { message: 'Session revoked successfully' };
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionManagementResultDto> {
    const count = await this.sessionManagementService.revokeAllOtherSessions(
      userId,
      currentSessionId,
    );
    return {
      message: `${count} session${count !== 1 ? 's' : ''} revoked. Current device remains logged in.`,
    };
  }

  async getSecurityDashboard(userId: string): Promise<SecurityDashboardDto> {
    const dashboard = await this.authRegistrationService.getSecurityDashboard(userId);
    const activeSessionCount = await this.sessionManagementService.getActiveSessionCount(userId);

    return {
      emailVerified: dashboard.emailVerified,
      activeSessionCount,
      lastSuccessfulLoginAt: dashboard.lastLoginAt,
      lastPasswordChangeAt: dashboard.lastPasswordChangedAt,
    };
  }
}
