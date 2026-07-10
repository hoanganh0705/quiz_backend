import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { AccountSecurityDto } from '../../dto/response/session-management.dto';
import type { ChangePasswordResponseDto } from '../../dto/response/change-password-response.dto';
import type { CheckEmailResponseDto } from '../../dto/response/check-email-response.dto';
import type { CheckUsernameResponseDto } from '../../dto/response/check-username-response.dto';
import type { CurrentUserResponseDto } from '../../dto/response/current-user-response.dto';
import type { DeleteAccountResponseDto } from '../../dto/response/delete-account-response.dto';
import type { ForgotPasswordResponseDto } from '../../dto/response/password-reset.dto';
import type { LoginResponseDto } from '../../dto/response/login-response.dto';
import type { LogoutResponseDto } from '../../dto/response/logout-response.dto';
import type { RefreshTokenResponseDto } from '../../dto/response/refresh-token-response.dto';
import type { RegisterResponseDto } from '../../dto/response/register-response.dto';
import type { SessionListResponseDto } from '../../dto/response/session-management.dto';
import type { SessionManagementResultDto } from '../../dto/response/session-management.dto';
import type { VerifyEmailResponseDto } from '../../dto/response/verify-email-response.dto';
import type { VerifyPasswordResponseDto } from '../../dto/response/verify-password-response.dto';

/**
 * Presenter for the auth module. Wraps every application-service response in
 * the canonical `{ data, meta.timestamp }` envelope.
 *
 * Currently a thin pass-through to {@link ApiResponse.ok}. The layer exists
 * separately from the controller so future module-specific shaping (sensitive
 * field redaction, conditional fields, additional meta) has a stable seam.
 *
 * Only the four endpoints migrated in Phase 1 (register, login, getCurrentUser,
 * changePassword) actually invoke these methods today. The full set is
 * declared up front so a grep for `presenter.<name>` always reveals what's
 * available — making future migrations (Phase 1.5 / Phase 2) easier to
 * stage.
 */
@Injectable()
export class AuthPresenter {
  // Free-standing arrow function (not a class method) so we don't trip the
  // `@typescript-eslint/unbound-method` rule when stored as class fields.
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  readonly register = AuthPresenter.ok<RegisterResponseDto>;
  readonly verifyEmail = AuthPresenter.ok<VerifyEmailResponseDto>;
  readonly resendVerificationEmail = AuthPresenter.ok<VerifyEmailResponseDto>;
  readonly login = AuthPresenter.ok<LoginResponseDto>;
  readonly googleLogin = AuthPresenter.ok<LoginResponseDto>;
  readonly refreshToken = AuthPresenter.ok<RefreshTokenResponseDto>;
  readonly logout = AuthPresenter.ok<LogoutResponseDto>;
  readonly logoutAll = AuthPresenter.ok<LogoutResponseDto>;
  readonly revokeSession = AuthPresenter.ok<SessionManagementResultDto>;
  readonly revokeOtherSessions = AuthPresenter.ok<SessionManagementResultDto>;
  readonly getActiveSessions = AuthPresenter.ok<SessionListResponseDto>;
  readonly getSecurityDashboard = AuthPresenter.ok<AccountSecurityDto>;
  readonly forgotPassword = AuthPresenter.ok<ForgotPasswordResponseDto>;
  readonly resetPassword = AuthPresenter.ok<VerifyEmailResponseDto>;
  readonly changePassword = AuthPresenter.ok<ChangePasswordResponseDto>;
  readonly getCurrentUser = AuthPresenter.ok<CurrentUserResponseDto>;
  readonly checkEmail = AuthPresenter.ok<CheckEmailResponseDto>;
  readonly checkUsername = AuthPresenter.ok<CheckUsernameResponseDto>;
  readonly verifyPassword = AuthPresenter.ok<VerifyPasswordResponseDto>;
  readonly deleteAccount = AuthPresenter.ok<DeleteAccountResponseDto>;
}
