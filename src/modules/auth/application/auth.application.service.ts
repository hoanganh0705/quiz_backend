import { Injectable } from '@nestjs/common';
import type { SessionRequestContext } from '../types/auth-context.types';
import type {
  LoginResult,
  RefreshTokenResult,
  ForgotPasswordResult,
  ResetPasswordResult,
} from '../types/auth-result.types';
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
import { OAuthLoginService as OAuthLoginServiceClass } from '../domain/oauth/oauth-login.service';
import { LoginResponseDto } from '../dto/response/login-response.dto';
import { RefreshTokenResponseDto } from '../dto/response/refresh-token-response.dto';
import { LogoutResponseDto } from '../dto/response/logout-response.dto';
import { ChangePasswordResponseDto } from '../dto/response/change-password-response.dto';
import { RegisterResponseDto } from '../dto/response/register-response.dto';
import { VerifyEmailResponseDto } from '../dto/response/verify-email-response.dto';
import {
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
} from '../dto/response/password-reset.dto';
import {
  SessionListResponseDto,
  SessionManagementResultDto,
} from '../dto/response/session-management.dto';
import { AccountSecurityDto } from '../dto/response/account-security.dto';
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

type SessionResponse = SessionListResponseDto['sessions'][number];

type ActiveSessionResult = Awaited<
  ReturnType<SessionManagementService['getActiveSessions']>
>[number];

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
    private readonly oauthLoginService: OAuthLoginServiceClass,
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
    return this.toLoginApplicationResult(result);
  }

  async googleLogin(
    idToken: string,
    session: SessionRequestContext,
  ): Promise<LoginApplicationResult> {
    const result = await this.oauthLoginService.login(
      { provider: 'google', authentication: { idToken } },
      session,
    );
    return this.toLoginApplicationResult(result);
  }

  async refreshToken(
    refreshToken: string,
    session: SessionRequestContext,
  ): Promise<RefreshTokenApplicationResult> {
    const result = await this.authRefreshService.refreshToken(refreshToken, session);
    return this.toRefreshTokenApplicationResult(result);
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
    return this.toMessageResponse(result);
  }

  async resetPassword(
    resetPasswordCommand: ResetPasswordCommand,
  ): Promise<ResetPasswordResponseDto> {
    const result = await this.passwordResetService.resetPassword(
      resetPasswordCommand.token,
      resetPasswordCommand.newPassword,
    );
    return this.toMessageResponse(result);
  }

  async changePassword(
    changePasswordCommand: ChangePasswordCommand,
    currentSessionId: string,
  ): Promise<ChangePasswordResponseDto> {
    const result = await this.changePasswordService.changePassword(
      changePasswordCommand.userId,
      changePasswordCommand.currentPassword,
      changePasswordCommand.newPassword,
      currentSessionId,
    );
    return this.authResponseMapper.toChangePasswordResponse(result.message);
  }

  async getActiveSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionListResponseDto> {
    const sessions = await this.sessionManagementService.getActiveSessions(userId);
    return {
      sessions: sessions.map((session) => this.toSessionResponse(session, currentSessionId)),
    };
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId: string,
    ipAddress?: string,
  ): Promise<SessionManagementResultDto> {
    await this.sessionManagementService.revokeSession(
      userId,
      sessionId,
      currentSessionId,
      ipAddress,
    );
    return { message: 'Session revoked successfully' };
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
    ipAddress?: string,
  ): Promise<SessionManagementResultDto> {
    const count = await this.sessionManagementService.revokeAllOtherSessions(
      userId,
      currentSessionId,
      ipAddress,
    );
    return {
      message: `${count} session${count !== 1 ? 's' : ''} revoked. Current device remains logged in.`,
    };
  }

  async getSecurityDashboard(userId: string): Promise<AccountSecurityDto> {
    const metadata = await this.accountSecurityService.getAccountSecurity(userId);

    const passwordAgeDays =
      metadata.lastPasswordChangedAt === null
        ? null
        : Math.max(
            0,
            Math.floor(
              (Date.now() - Date.parse(metadata.lastPasswordChangedAt)) / (1000 * 60 * 60 * 24),
            ),
          );

    return {
      emailVerified: metadata.emailVerified,
      activeSessionCount: metadata.activeSessionCount,
      lastSuccessfulLoginAt: metadata.lastLoginAt,
      lastPasswordChangeAt: metadata.lastPasswordChangedAt,
      passwordAgeDays,
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
    const result = await this.accountDeletionService.deleteAccountWithCredentialVerification(
      userId,
      password,
      ipAddress,
    );
    return this.authResponseMapper.toDeleteAccountResponse(result);
  }

  private toLoginApplicationResult(result: LoginResult): LoginApplicationResult {
    return {
      response: this.authResponseMapper.toLoginResponse(result),
      refreshToken: result.refreshToken,
      sessionId: result.sessionId,
    };
  }

  private toRefreshTokenApplicationResult(
    result: RefreshTokenResult,
  ): RefreshTokenApplicationResult {
    return {
      response: this.authResponseMapper.toRefreshTokenResponse(result),
      refreshToken: result.refreshToken,
    };
  }

  private toMessageResponse(result: ForgotPasswordResult): ForgotPasswordResponseDto;
  private toMessageResponse(result: ResetPasswordResult): ResetPasswordResponseDto;
  private toMessageResponse(result: { message: string }): { message: string } {
    return { message: result.message };
  }

  private toSessionResponse(
    session: ActiveSessionResult,
    currentSessionId: string,
  ): SessionResponse {
    return {
      ...session,
      isCurrentSession: session.sessionId === currentSessionId,
    };
  }
}
