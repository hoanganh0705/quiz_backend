import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseInterceptors,
  Get,
  Delete,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConflictResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import {
  ApiBadRequest,
  ApiConflict,
  ApiInternalError,
  ApiNotFound,
  ApiTooManyRequests,
  ApiUnauthorized,
} from '@/common/swagger/swagger-decorators';
import { ApiCookieParam, registerCookieParam } from '@/common/swagger/cookie-params.plugin';
import { ApiOkResource, ApiCreatedResource } from '@/common/swagger/api-ok';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { RefreshToken } from '../decorators/refresh-token.decorator';
import { RequestContext } from '../decorators/request-context.decorator';
import { RequestContextInterceptor } from '../interceptors/request-context.interceptor';
import { RefreshTokenInterceptor } from '../interceptors/refresh-token.interceptor';
import { AuthApplicationService } from '../../application/auth.application.service';
import { LoginDto } from '../../dto/request/login.dto';
import { LoginResponseDto } from '../../dto/response/login-response.dto';
import { RegisterDto } from '../../dto/request/register.dto';
import { RegisterResponseDto } from '../../dto/response/register-response.dto';
import { RefreshTokenResponseDto } from '../../dto/response/refresh-token-response.dto';
import { LogoutResponseDto } from '../../dto/response/logout-response.dto';
import { ChangePasswordResponseDto } from '../../dto/response/change-password-response.dto';
import { VerifyEmailDto } from '../../dto/request/verify-email.dto';
import { VerifyEmailResponseDto } from '../../dto/response/verify-email-response.dto';
import { ResendVerificationDto } from '../../dto/request/resend-verification.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from '../../dto/request/password-reset.dto';
import {
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
} from '../../dto/response/password-reset.dto';
import {
  SessionListResponseDto,
  SessionManagementResultDto,
} from '../../dto/response/session-management.dto';
import { AccountSecurityDto } from '../../dto/response/account-security.dto';
import { CurrentUserResponseDto } from '../../dto/response/current-user-response.dto';
import { VerifyPasswordResponseDto } from '../../dto/response/verify-password-response.dto';
import { CheckEmailDto } from '../../dto/request/check-email.dto';
import { CheckEmailResponseDto } from '../../dto/response/check-email-response.dto';
import { CheckUsernameDto } from '../../dto/request/check-username.dto';
import { CheckUsernameResponseDto } from '../../dto/response/check-username-response.dto';
import { DeleteAccountDto } from '../../dto/request/delete-account.dto';
import { DeleteAccountResponseDto } from '../../dto/response/delete-account-response.dto';
import { GoogleLoginDto } from '../../dto/request/google-login.dto';
import { AuthPresenter } from '../presenters/auth.presenter';
import { AUTH_THROTTLE } from '../../config/throttle.constants';
// All endpoints now use @ApiOkResource / @ApiCreatedResource with the
// presenter layer. The hand-rolled AuthWrapped*Dto classes in
// `auth-response-docs.dto.ts` are no longer referenced and have been removed
// (see docs/migrations/RESPONSE_ENVELOPE_MIGRATION.md §5.3).
import type { AuthRequestContext } from '../types/auth-http-context.types';
import type {
  LoginCommand,
  RegisterCommand,
  ResendVerificationEmailCommand,
  VerifyEmailCommand,
  ForgotPasswordCommand,
  ResetPasswordCommand,
  ChangePasswordCommand,
} from '../../domain/types/auth-commands';
import { VerifyPasswordDto } from '../../dto/request/verify-password.dto';

const setCookieHeaderSchema = {
  description: 'Refresh token cookie. HttpOnly, SameSite=Lax, Secure in production.',
  schema: {
    type: 'string',
    example: 'refreshToken=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800',
  },
};

const clearCookieHeaderSchema = {
  description: 'Cleared refresh token cookie (Max-Age=0 with expires in the past).',
  schema: {
    type: 'string',
    example: 'refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly',
  },
};

/**
 * Side-effect: register the cookie parameters consumed by this controller's
 * routes so the Swagger plugin can inject `in: 'cookie'` parameters into the
 * generated OpenAPI document. Renaming a route requires updating the path
 * here — but no longer requires editing a shared plugin.
 */
registerCookieParam('/api/v1/auth/refresh-token', 'post', {
  name: 'refreshToken',
  required: true,
  description: 'HttpOnly refresh token cookie. Must be present for token rotation.',
});
registerCookieParam('/api/v1/auth/logout', 'post', {
  name: 'refreshToken',
  required: false,
  description: 'HttpOnly refresh token cookie. Cleared on successful logout when present.',
});

@ApiTags('auth')
@Controller('auth')
// Order matters: RefreshTokenInterceptor MUST wrap RequestContextInterceptor
// so its finalize() callback sees the populated AuthRequestContext.cookieInstructions.
@UseInterceptors(RequestContextInterceptor, RefreshTokenInterceptor)
export class AuthController {
  constructor(
    private readonly authApplicationService: AuthApplicationService,
    private readonly presenter: AuthPresenter,
  ) {}

  @Public()
  @Throttle({ default: AUTH_THROTTLE.register })
  @Post('register')
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'Creates a new user account and sends a verification email to the provided address. ' +
      'Returns 201 with a generic acknowledgement message regardless of whether the email ' +
      'or username is already registered, to prevent account enumeration. ' +
      'Clients should treat a 201 response as "your request was received" and ' +
      'attempt to log in (or check the inbox) to determine the actual outcome.',
  })
  @ApiCreatedResource(RegisterResponseDto, {
    description:
      'Generic acknowledgement — the same message is returned whether the email/username was already registered or not, to prevent account enumeration.',
    examples: {
      newAccount: {
        summary: 'New account (verification email sent)',
        value: {
          data: {
            message: 'If your registration can be completed, a verification email will be sent.',
          },
          meta: { timestamp: '2026-07-14T01:23:45.000Z' },
        },
      },
      duplicateEmailOrUsername: {
        summary: 'Duplicate email or username (anti-enumeration)',
        value: {
          data: {
            message: 'If your registration can be completed, a verification email will be sent.',
          },
          meta: { timestamp: '2026-07-14T01:23:45.000Z' },
        },
      },
    },
  })
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async register(@Body() registerDto: RegisterDto) {
    const command: RegisterCommand = {
      username: registerDto.username,
      email: registerDto.email,
      password: registerDto.password,
    };

    const result = await this.authApplicationService.register(command);
    return this.presenter.register(result);
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.verifyEmail })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email address',
    description:
      'Confirms an email address using the token from the verification email. ' +
      'Returns the same generic acknowledgement message regardless of whether ' +
      'the token is valid, expired, or unknown — this prevents account/token enumeration. ' +
      'Clients should treat a 200 response as "your request was received" and ' +
      'verify the email through other means (e.g., attempting to log in).',
  })
  @ApiOkResource(VerifyEmailResponseDto, {
    description:
      'Generic acknowledgement — the same message is returned for valid, expired, and unknown tokens to prevent enumeration.',
    examples: {
      validToken: {
        summary: 'Valid, unexpired token',
        value: {
          data: {
            message: 'Verification processed. If valid, your email is now verified.',
          },
          meta: { timestamp: '2026-07-14T01:23:45.000Z' },
        },
      },
      unknownOrExpiredToken: {
        summary: 'Unknown or expired token (anti-enumeration)',
        value: {
          data: {
            message: 'Verification processed. If valid, your email is now verified.',
          },
          meta: { timestamp: '2026-07-14T01:23:45.000Z' },
        },
      },
    },
  })
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    const command: VerifyEmailCommand = {
      token: verifyEmailDto.token,
    };

    const result = await this.authApplicationService.verifyEmail(command);
    return this.presenter.verifyEmail(result);
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.resendVerificationEmail })
  @Post('resend-verification-email')
  @ApiOperation({
    summary: 'Resend verification email',
    description:
      'Sends a new verification email to the provided address if the account exists and is unverified. ' +
      'Returns the same generic acknowledgement message regardless of whether the email ' +
      'is registered, already verified, or unknown — this prevents account enumeration. ' +
      'Clients should treat a 200 response as "your request was received" and ' +
      'check the inbox (or attempt to log in) to confirm.',
  })
  @ApiCreatedResource(VerifyEmailResponseDto, {
    description:
      'Generic acknowledgement — the same message is returned whether the email exists, is already verified, or is unknown, to prevent enumeration.',
    examples: {
      unverifiedEmailExists: {
        summary: 'Unverified email exists (new email sent)',
        value: {
          data: {
            message:
              'If this email exists and is not verified, a verification email has been sent.',
          },
          meta: { timestamp: '2026-07-14T01:23:45.000Z' },
        },
      },
      unknownOrAlreadyVerifiedEmail: {
        summary: 'Unknown or already-verified email (anti-enumeration)',
        value: {
          data: {
            message:
              'If this email exists and is not verified, a verification email has been sent.',
          },
          meta: { timestamp: '2026-07-14T01:23:45.000Z' },
        },
      },
    },
  })
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async resendVerificationEmail(@Body() resendVerificationDto: ResendVerificationDto) {
    const command: ResendVerificationEmailCommand = {
      email: resendVerificationDto.email,
    };

    const result = await this.authApplicationService.resendVerificationEmail(command);
    return this.presenter.resendVerificationEmail(result);
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.login })
  @Post('login')
  @ApiOperation({
    summary: 'Log in',
    description:
      'Authenticates with email and password and returns a JWT access token. ' +
      'A refresh token cookie is set on success. Device information is collected for security purposes.',
  })
  @ApiCreatedResource(LoginResponseDto, {
    description: 'Login successful',
    headers: { 'Set-Cookie': setCookieHeaderSchema },
  })
  @ApiUnauthorized()
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async login(@Body() loginDto: LoginDto, @RequestContext() context: AuthRequestContext) {
    const command: LoginCommand = {
      email: loginDto.email,
      password: loginDto.password,
    };

    const loginResult = await this.authApplicationService.login(command, context.session);
    context.setRefreshToken(loginResult.refreshToken);
    return this.presenter.login(loginResult.response);
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.googleLogin })
  @Post('oauth/google')
  @ApiOperation({
    summary: 'Log in with Google',
    description:
      'Authenticates using a Google ID token and returns a JWT access token. ' +
      'If no account exists for the Google user, one is created automatically. ' +
      'A refresh token cookie is set on success.',
  })
  @ApiCreatedResource(LoginResponseDto, {
    description: 'Login successful',
    headers: { 'Set-Cookie': setCookieHeaderSchema },
  })
  @ApiUnauthorized()
  @ApiBadRequest()
  @ApiConflict()
  @ApiTooManyRequests()
  @ApiInternalError()
  async googleLogin(
    @Body() googleLoginDto: GoogleLoginDto,
    @RequestContext() context: AuthRequestContext,
  ) {
    const loginResult: { response: LoginResponseDto; refreshToken: string; sessionId: string } =
      await this.authApplicationService.googleLogin(googleLoginDto.idToken, context.session);
    context.setRefreshToken(loginResult.refreshToken);
    return this.presenter.googleLogin(loginResult.response);
  }

  @Public()
  @ApiCookieParam('refreshToken', {
    required: true,
    description: 'HttpOnly refresh token cookie. Must be present for token rotation.',
  })
  @Post('refresh-token')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchanges a valid refresh token cookie for a new JWT access token. ' +
      'The refresh token cookie is rotated on success.',
  })
  @ApiCreatedResource(RefreshTokenResponseDto, {
    description: 'Token refreshed',
    headers: { 'Set-Cookie': setCookieHeaderSchema },
  })
  @ApiUnauthorized()
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async refreshToken(
    @RefreshToken({ required: true }) refreshToken: string,
    @RequestContext() context: AuthRequestContext,
  ) {
    const refreshResult: { response: RefreshTokenResponseDto; refreshToken: string } =
      await this.authApplicationService.refreshToken(refreshToken, context.session);
    context.setRefreshToken(refreshResult.refreshToken);
    return this.presenter.refreshToken(refreshResult.response);
  }

  @Public()
  @ApiCookieParam('refreshToken', {
    required: false,
    description: 'HttpOnly refresh token cookie. Cleared on successful logout when present.',
  })
  @Post('logout')
  @ApiOperation({
    summary: 'Log out',
    description:
      'Idempotent logout. Always returns 201 and clears the refresh token cookie. ' +
      'If the cookie is missing, the request still succeeds (the cookie is already cleared). ' +
      'The access token remains valid until it expires.',
  })
  @ApiCreatedResource(LogoutResponseDto, {
    description: 'Logged out successfully',
    headers: { 'Set-Cookie': clearCookieHeaderSchema },
  })
  @ApiInternalError()
  async logout(
    @RefreshToken() refreshToken: string | null,
    @RequestContext() context: AuthRequestContext,
  ) {
    const response = await this.authApplicationService.logout(refreshToken);
    context.clearRefreshToken();
    return this.presenter.logout(response);
  }

  @ApiAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log out all sessions',
    description:
      'Invalidates ALL active sessions for the authenticated user and clears the refresh token cookie.',
  })
  @ApiOkResource(LogoutResponseDto, {
    description: 'All sessions terminated',
    headers: { 'Set-Cookie': clearCookieHeaderSchema },
  })
  @ApiUnauthorized()
  @ApiInternalError()
  async logoutAll(
    @CurrentUser('sub') userId: string,
    @RequestContext() context: AuthRequestContext,
  ) {
    const response = await this.authApplicationService.logoutAll(userId);
    context.clearRefreshToken();
    return this.presenter.logoutAll(response);
  }

  // ─── FEATURE 1: Session Management ───────────────────────────────────────

  @ApiAuth()
  @Get('sessions')
  @ApiOperation({
    summary: 'List active sessions',
    description:
      'Returns all active sessions for the authenticated user, ordered by most recent activity. ' +
      'The current session is marked with isCurrentSession: true.',
  })
  @ApiOkResource(SessionListResponseDto, {
    description: 'Active sessions retrieved',
  })
  @ApiUnauthorized()
  @ApiInternalError()
  async getActiveSessions(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
  ) {
    const result = await this.authApplicationService.getActiveSessions(userId, currentSessionId);
    return this.presenter.getActiveSessions(result);
  }

  @ApiAuth()
  @Delete('sessions/others')
  @ApiOperation({
    summary: 'Log out all other devices',
    description:
      'Normalized REST route. Keeps the current session and revokes every other active session for the user.',
  })
  @ApiOkResource(SessionManagementResultDto, {
    description: 'Other sessions revoked',
  })
  @ApiUnauthorized()
  @ApiInternalError()
  async revokeOtherSessions(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
    @RequestContext() context: AuthRequestContext,
  ) {
    const result = await this.authApplicationService.revokeAllOtherSessions(
      userId,
      currentSessionId,
      context.session.ipAddress ?? undefined,
    );
    return this.presenter.revokeOtherSessions(result);
  }

  @ApiAuth()
  @Delete('sessions/:sessionId')
  @ApiOperation({
    summary: 'Revoke a session',
    description:
      'Revokes a specific session by ID. Use this when you want to terminate a single ' +
      'device or browser while keeping the rest of your sessions active. ' +
      'If the target is the current session, the user is logged out (cookie cleared). ' +
      'Otherwise only the target session is invalidated.',
  })
  @ApiOkResource(SessionManagementResultDto, {
    description: 'Session revoked',
    headers: { 'Set-Cookie': clearCookieHeaderSchema },
  })
  @ApiUnauthorized()
  @ApiNotFound()
  @ApiInternalError()
  async revokeSession(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
    @Param('sessionId', new ParseUUIDPipe({ version: '7' })) sessionId: string,
    @RequestContext() context: AuthRequestContext,
  ) {
    const result = await this.authApplicationService.revokeSession(
      userId,
      sessionId,
      currentSessionId,
      context.session.ipAddress ?? undefined,
    );
    return this.presenter.revokeSession(result);
  }

  @ApiAuth()
  @Get('security/dashboard')
  @ApiOperation({
    summary: 'Account security dashboard',
    description: 'Returns security-related information about the authenticated user account.',
  })
  @ApiOkResource(AccountSecurityDto, {
    description: 'Security dashboard retrieved',
  })
  @ApiUnauthorized()
  @ApiInternalError()
  async getSecurityDashboard(@CurrentUser('sub') userId: string) {
    const result = await this.authApplicationService.getSecurityDashboard(userId);
    return this.presenter.getSecurityDashboard(result);
  }

  // ─── FEATURE 2: Password Reset ────────────────────────────────────────────

  @Public()
  @Throttle({ default: AUTH_THROTTLE.forgotPassword })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Sends a password reset email if the account exists. ' +
      'Always returns a generic success message to prevent email enumeration.',
  })
  @ApiOkResource(ForgotPasswordResponseDto, {
    description: 'Password reset email sent (if account exists)',
  })
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const command: ForgotPasswordCommand = { email: forgotPasswordDto.email };
    const result = await this.authApplicationService.forgotPassword(command);
    return this.presenter.forgotPassword(result);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password',
    description:
      'Resets the account password using a valid token. ' +
      'All active sessions are immediately invalidated after a successful reset.',
  })
  @ApiCreatedResource(ResetPasswordResponseDto, {
    description: 'Password reset successfully',
  })
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const command: ResetPasswordCommand = {
      token: resetPasswordDto.token,
      newPassword: resetPasswordDto.newPassword,
    };
    const result = await this.authApplicationService.resetPassword(command);
    return this.presenter.resetPassword(result);
  }

  @ApiAuth()
  @Post('change-password')
  @ApiOperation({
    summary: 'Change password',
    description:
      'Changes the account password for an authenticated user. ' +
      'Requires the current password and terminates all other active sessions.',
  })
  @ApiCreatedResource(ChangePasswordResponseDto, {
    description: 'Password changed successfully',
  })
  @ApiUnauthorized()
  @ApiBadRequest()
  @ApiConflictResponse({
    description: 'New password has been used recently. Please choose a different password.',
    type: ProblemDetailDto,
    example: {
      type: 'https://docs.Quiz.dev/errors/auth-password-reuse',
      title: 'Password Recently Used',
      status: 409,
      detail: 'Password has been used recently. Please choose a different password.',
      instance: '/api/v1/auth/change-password',
      extensions: {
        code: 'AUTH_PASSWORD_REUSE',
        requestId: 'req_abc123',
      },
    },
  })
  @ApiTooManyRequests()
  @ApiInternalError()
  async changePassword(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const command: ChangePasswordCommand = {
      userId,
      currentPassword: changePasswordDto.currentPassword,
      newPassword: changePasswordDto.newPassword,
    };
    const result = await this.authApplicationService.changePassword(command, currentSessionId);
    return this.presenter.changePassword(result);
  }

  // ─── FEATURE 3: Account Profile ──────────────────────────────────────────

  @ApiAuth()
  @Get('me')
  @ApiOperation({
    summary: 'Get current user identity',
    description:
      'Returns the authenticated principal identity (userId, username, email, role, isVerified).\n\n' +
      'This is the slim identity payload used to bootstrap the auth state on the client. ' +
      'For the full user profile (display name, avatar, bio, XP, streaks, settings, timestamps), ' +
      'use `GET /api/v1/users/me` instead. ' +
      'The two endpoints are complementary, not interchangeable.',
  })
  @ApiOkResource(CurrentUserResponseDto, {
    description: 'Current user identity retrieved',
  })
  @ApiUnauthorized()
  @ApiInternalError()
  async getCurrentUser(@CurrentUser('sub') userId: string) {
    const result = await this.authApplicationService.getCurrentUser(userId);
    return this.presenter.getCurrentUser(result);
  }

  // ─── FEATURE 4: Availability Check ───────────────────────────────────────

  @Public()
  @Throttle({ default: AUTH_THROTTLE.checkAvailability })
  @Get('check-email')
  @ApiOperation({
    summary: 'Check email availability',
    description:
      'Checks whether an email address is available for registration. ' +
      'Does not reveal whether an account exists.',
  })
  @ApiOkResource(CheckEmailResponseDto, {
    description: 'Email availability checked',
  })
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async checkEmail(@Query() dto: CheckEmailDto) {
    const result = await this.authApplicationService.checkEmailAvailability(dto.email);
    return this.presenter.checkEmail(result);
  }

  /**
   * Deprecated: prefer `GET /auth/check-email?email=...`. This POST alias is
   * kept for one minor version to give frontend teams time to migrate. It
   * forwards to the same service and returns the same response shape.
   */
  @Public()
  @Throttle({ default: AUTH_THROTTLE.checkAvailability })
  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check email availability (deprecated)',
    deprecated: true,
    description:
      'Deprecated alias of `GET /auth/check-email?email=...`. Returns the same response. ' +
      'Prefer the GET form; this POST route will be removed in the next minor version.',
  })
  @ApiOkResource(CheckEmailResponseDto, {
    description: 'Email availability checked (deprecated POST alias)',
  })
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async checkEmailDeprecated(@Body() dto: CheckEmailDto) {
    const result = await this.authApplicationService.checkEmailAvailability(dto.email);
    return this.presenter.checkEmail(result);
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.checkAvailability })
  @Get('check-username')
  @ApiOperation({
    summary: 'Check username availability',
    description:
      'Checks whether a username is available for registration. ' +
      'Does not reveal whether an account exists.',
  })
  @ApiOkResource(CheckUsernameResponseDto, {
    description: 'Username availability checked',
  })
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async checkUsername(@Query() dto: CheckUsernameDto) {
    const result = await this.authApplicationService.checkUsernameAvailability(dto.username);
    return this.presenter.checkUsername(result);
  }

  /**
   * Deprecated: prefer `GET /auth/check-username?username=...`. This POST alias
   * is kept for one minor version to give frontend teams time to migrate. It
   * forwards to the same service and returns the same response shape.
   */
  @Public()
  @Throttle({ default: AUTH_THROTTLE.checkAvailability })
  @Post('check-username')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check username availability (deprecated)',
    deprecated: true,
    description:
      'Deprecated alias of `GET /auth/check-username?username=...`. Returns the same response. ' +
      'Prefer the GET form; this POST route will be removed in the next minor version.',
  })
  @ApiOkResource(CheckUsernameResponseDto, {
    description: 'Username availability checked (deprecated POST alias)',
  })
  @ApiBadRequest()
  @ApiTooManyRequests()
  @ApiInternalError()
  async checkUsernameDeprecated(@Body() dto: CheckUsernameDto) {
    const result = await this.authApplicationService.checkUsernameAvailability(dto.username);
    return this.presenter.checkUsername(result);
  }

  // ─── FEATURE 5: Password Verification ────────────────────────────────────

  @ApiAuth()
  @Post('verify-password')
  @ApiOperation({
    summary: 'Verify current password',
    description:
      "Verifies the authenticated user's current password without issuing tokens or sessions. " +
      'Intended as a confirmation step before sensitive operations.',
  })
  @ApiCreatedResource(VerifyPasswordResponseDto, {
    description: 'Password verification result',
  })
  @ApiUnauthorized()
  @ApiInternalError()
  async verifyPassword(@CurrentUser('sub') userId: string, @Body() dto: VerifyPasswordDto) {
    const result = await this.authApplicationService.verifyPassword(userId, dto.password);
    return this.presenter.verifyPassword(result);
  }

  // ─── FEATURE 6: Account Deletion ─────────────────────────────────────────

  @ApiAuth()
  @Delete('account')
  @ApiOperation({
    summary: 'Delete account',
    description:
      "Permanently deletes the authenticated user's account after password confirmation. " +
      'All active sessions are terminated immediately and the refresh token cookie is cleared.',
  })
  @ApiOkResource(DeleteAccountResponseDto, {
    description: 'Account deleted',
    headers: { 'Set-Cookie': clearCookieHeaderSchema },
  })
  @ApiUnauthorized()
  @ApiBadRequest()
  @ApiConflict()
  @ApiInternalError()
  async deleteAccount(
    @CurrentUser('sub') userId: string,
    @Body() dto: DeleteAccountDto,
    @RequestContext() context: AuthRequestContext,
  ) {
    const response = await this.authApplicationService.deleteAccount(
      userId,
      dto.password,
      context.session.ipAddress ?? undefined,
    );
    context.clearRefreshToken();
    return this.presenter.deleteAccount(response);
  }
}
