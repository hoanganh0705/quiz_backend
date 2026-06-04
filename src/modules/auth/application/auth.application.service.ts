import { Injectable } from '@nestjs/common';
import { InvalidCredentialsError } from '../domain/errors';
import type { SessionRequestContext } from '../types/auth-context.types';
import { AuthLoginService } from '../domain/auth-login.service';
import { AuthRefreshService } from '../domain/auth-refresh.service';
import { AuthRegistrationService } from '../domain/auth-registration.service';
import { PasswordResetService } from '../domain/password-reset.service';
import { ChangePasswordService } from '../domain/change-password.service';
import { SessionManagementService } from '../domain/session-management.service';
import { AccountSecurityService } from '../domain/account-security.service';
import { CredentialVerificationService } from '../domain/credential-verification.service';
import { AccountDeletionService } from '../domain/account-deletion.service';
import { RegistrationAvailabilityService } from '../domain/registration-availability.service';
import type {
  LoginCommand,
  RegisterCommand,
  ResendVerificationEmailCommand,
  VerifyEmailCommand,
  ForgotPasswordCommand,
  ResetPasswordCommand,
  ChangePasswordCommand,
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
  AccountSecurityDto,
  SessionManagementResultDto,
} from '../dto/response/session-management.dto';
import { CurrentUserResponseDto } from '../dto/response/current-user-response.dto';
import { VerifyPasswordResponseDto } from '../dto/response/verify-password-response.dto';
import { CheckEmailResponseDto } from '../dto/response/check-email-response.dto';
import { CheckUsernameResponseDto } from '../dto/response/check-username-response.dto';
import { DeleteAccountResponseDto } from '../dto/response/delete-account-response.dto';
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
    private readonly accountSecurityService: AccountSecurityService,
    private readonly credentialVerificationService: CredentialVerificationService,
    private readonly accountDeletionService: AccountDeletionService,
    private readonly registrationAvailabilityService: RegistrationAvailabilityService,
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
    const sessions = await this.sessionManagementService.getActiveSessions(userId);
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

  async getSecurityDashboard(userId: string): Promise<AccountSecurityDto> {
    const [metadata, activeSessionCount] = await Promise.all([
      this.accountSecurityService.getAccountSecurity(userId),
      this.accountSecurityService.getActiveSessionCount(userId),
    ]);

    return {
      emailVerified: metadata.emailVerified,
      activeSessionCount,
      lastSuccessfulLoginAt: metadata.lastLoginAt,
      lastPasswordChangeAt: metadata.lastPasswordChangedAt,
    };
  }

  async getCurrentUser(userId: string): Promise<CurrentUserResponseDto> {
    const result = await this.accountSecurityService.getCurrentUser(userId);
    return this.authResponseMapper.toCurrentUserResponse(result);
  }

  async checkEmailAvailability(email: string): Promise<CheckEmailResponseDto> {
    const result = await this.registrationAvailabilityService.checkEmailAvailability(email);
    return this.authResponseMapper.toCheckEmailResponse(result);
  }

  async checkUsernameAvailability(username: string): Promise<CheckUsernameResponseDto> {
    const result = await this.registrationAvailabilityService.checkUsernameAvailability(username);
    return this.authResponseMapper.toCheckUsernameResponse(result);
  }

  async verifyPassword(userId: string, password: string): Promise<VerifyPasswordResponseDto> {
    const result = await this.credentialVerificationService.verifyPassword(userId, password);
    return this.authResponseMapper.toVerifyPasswordResponse(result);
  }

  async deleteAccount(
    userId: string,
    password: string,
    ipAddress?: string,
  ): Promise<DeleteAccountResponseDto> {
    const result = await this.credentialVerificationService.verifyPassword(userId, password);
    if (!result.valid) {
      throw new InvalidCredentialsError();
    }

    const identity = await this.accountSecurityService.getCurrentUser(userId);
    const deletionResult = await this.accountDeletionService.deleteAccount(
      userId,
      identity.email,
      ipAddress,
    );
    return this.authResponseMapper.toDeleteAccountResponse(deletionResult);
  }
}
