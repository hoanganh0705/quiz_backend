import {
  Body,
  Controller,
  Post,
  UseFilters,
  UseInterceptors,
  Get,
  Delete,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { RefreshToken } from '../decorators/refresh-token.decorator';
import { RequestContext } from '../decorators/request-context.decorator';
import { RequestContextInterceptor } from '../interceptors/request-context.interceptor';
import { RefreshTokenInterceptor } from '../interceptors/refresh-token.interceptor';
import { AuthDomainExceptionFilter } from '../filters/auth-domain-exception.filter';
import { AuthApplicationService } from '../../application/auth.application.service';
import { LoginDto } from '../../dto/request/login.dto';
import { LoginResponseDto } from '../../dto/response/login-response.dto';
import { RegisterDto } from '../../dto/request/register.dto';
import { RegisterResponseDto } from '../../dto/response/register-response.dto';
import { RefreshTokenResponseDto } from '../../dto/response/refresh-token-response.dto';
import { LogoutResponseDto } from '../../dto/response/logout-response.dto';
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
  AccountSecurityDto,
  SessionManagementResultDto,
} from '../../dto/response/session-management.dto';
import { CurrentUserResponseDto } from '../../dto/response/current-user-response.dto';
import { VerifyPasswordResponseDto } from '../../dto/response/verify-password-response.dto';
import { CheckEmailDto } from '../../dto/request/check-email.dto';
import { CheckEmailResponseDto } from '../../dto/response/check-email-response.dto';
import { CheckUsernameDto } from '../../dto/request/check-username.dto';
import { CheckUsernameResponseDto } from '../../dto/response/check-username-response.dto';
import { DeleteAccountDto } from '../../dto/request/delete-account.dto';
import { DeleteAccountResponseDto } from '../../dto/response/delete-account-response.dto';
import { GoogleLoginDto } from '../../dto/request/google-login.dto';
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

@ApiTags('auth')
@Controller('auth')
@UseInterceptors(RequestContextInterceptor, RefreshTokenInterceptor)
@UseFilters(AuthDomainExceptionFilter)
export class AuthController {
  constructor(private readonly authApplicationService: AuthApplicationService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'Creates a new user account and sends a verification email to the provided address.',
  })
  @ApiCreatedResponse({ description: 'Account created successfully', type: RegisterResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed or email/username already in use' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
    const command: RegisterCommand = {
      username: registerDto.username,
      email: registerDto.email,
      password: registerDto.password,
    };

    return this.authApplicationService.register(command);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @ApiOperation({
    summary: 'Verify email address',
    description: 'Confirms an email address using the token from the verification email.',
  })
  @ApiOkResponse({ description: 'Email verified successfully', type: VerifyEmailResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or expired token' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    const command: VerifyEmailCommand = {
      token: verifyEmailDto.token,
    };

    return this.authApplicationService.verifyEmail(command);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification-email')
  @ApiOperation({
    summary: 'Resend verification email',
    description:
      'Sends a new verification email to the provided address if the account exists and is unverified.',
  })
  @ApiOkResponse({ description: 'Verification email sent', type: VerifyEmailResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid email address' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async resendVerificationEmail(
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<VerifyEmailResponseDto> {
    const command: ResendVerificationEmailCommand = {
      email: resendVerificationDto.email,
    };

    return this.authApplicationService.resendVerificationEmail(command);
  }

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Log in',
    description:
      'Authenticates with email and password and returns a JWT access token. Device information is collected for security purposes.',
  })
  @ApiOkResponse({ description: 'Login successful', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async login(
    @Body() loginDto: LoginDto,
    @RequestContext() context: AuthRequestContext,
  ): Promise<LoginResponseDto> {
    const command: LoginCommand = {
      email: loginDto.email,
      password: loginDto.password,
    };

    const loginResult: { response: LoginResponseDto; refreshToken: string; sessionId: string } =
      await this.authApplicationService.login(command, context.session);
    context.setRefreshToken(loginResult.refreshToken);
    return loginResult.response;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('oauth/google')
  @ApiOperation({
    summary: 'Log in with Google',
    description:
      'Authenticates using a Google ID token and returns a JWT access token. ' +
      'If no account exists for the Google user, one is created automatically.',
  })
  @ApiOkResponse({ description: 'Login successful', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired Google ID token' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async googleLogin(
    @Body() googleLoginDto: GoogleLoginDto,
    @RequestContext() context: AuthRequestContext,
  ): Promise<LoginResponseDto> {
    const loginResult: { response: LoginResponseDto; refreshToken: string; sessionId: string } =
      await this.authApplicationService.googleLogin(googleLoginDto.idToken, context.session);
    context.setRefreshToken(loginResult.refreshToken);
    return loginResult.response;
  }

  @Public()
  @Post('refresh-token')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Exchanges a valid refresh token cookie for a new JWT access token.',
  })
  @ApiOkResponse({ description: 'Token refreshed', type: RefreshTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid refresh token' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async refreshToken(
    @RefreshToken({ required: true }) refreshToken: string,
    @RequestContext() context: AuthRequestContext,
  ): Promise<RefreshTokenResponseDto> {
    const refreshResult: { response: RefreshTokenResponseDto; refreshToken: string } =
      await this.authApplicationService.refreshToken(refreshToken, context.session);
    context.setRefreshToken(refreshResult.refreshToken);
    return refreshResult.response;
  }

  @Public()
  @Post('logout')
  @ApiOperation({
    summary: 'Log out',
    description:
      'Clears the refresh token cookie. The access token remains valid until it expires. Requires the refresh token cookie to be present.',
  })
  @ApiOkResponse({ description: 'Logged out successfully', type: LogoutResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async logout(
    @RefreshToken() refreshToken: string | null,
    @RequestContext() context: AuthRequestContext,
  ): Promise<LogoutResponseDto> {
    const response = await this.authApplicationService.logout(refreshToken);
    context.clearRefreshToken();
    return response;
  }

  @ApiAuth()
  @Post('logout-all')
  @ApiOperation({
    summary: 'Log out all sessions',
    description:
      'Invalidates ALL active sessions for the authenticated user and clears the refresh token cookie.',
  })
  @ApiOkResponse({ description: 'All sessions terminated', type: LogoutResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async logoutAll(
    @CurrentUser('sub') userId: string,
    @RequestContext() context: AuthRequestContext,
  ): Promise<LogoutResponseDto> {
    const response = await this.authApplicationService.logoutAll(userId);
    context.clearRefreshToken();
    return response;
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
  @ApiOkResponse({ description: 'Active sessions retrieved', type: SessionListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getActiveSessions(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
  ): Promise<SessionListResponseDto> {
    return await this.authApplicationService.getActiveSessions(userId, currentSessionId);
  }

  @ApiAuth()
  @Delete('sessions/:sessionId')
  @ApiOperation({
    summary: 'Revoke a session',
    description:
      'Revokes a specific session. If the target is the current session, the user is logged out. ' +
      'Otherwise only the target session is invalidated.',
  })
  @ApiOkResponse({ description: 'Session revoked', type: SessionManagementResultDto })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated or session not owned by user' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async revokeSession(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<SessionManagementResultDto> {
    return await this.authApplicationService.revokeSession(userId, sessionId, currentSessionId);
  }

  @ApiAuth()
  @Post('sessions/logout-others')
  @ApiOperation({
    summary: 'Log out all other devices',
    description: 'Keeps the current session and revokes every other active session for the user.',
  })
  @ApiOkResponse({ description: 'Other sessions revoked', type: SessionManagementResultDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async logoutOtherDevices(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
  ): Promise<SessionManagementResultDto> {
    return await this.authApplicationService.revokeAllOtherSessions(userId, currentSessionId);
  }

  @ApiAuth()
  @Get('security/dashboard')
  @ApiOperation({
    summary: 'Account security dashboard',
    description: 'Returns security-related information about the authenticated user account.',
  })
  @ApiOkResponse({ description: 'Security dashboard retrieved', type: AccountSecurityDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getSecurityDashboard(@CurrentUser('sub') userId: string): Promise<AccountSecurityDto> {
    return await this.authApplicationService.getSecurityDashboard(userId);
  }

  // ─── FEATURE 2: Password Reset ────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Sends a password reset email if the account exists. ' +
      'Always returns a generic success message to prevent email enumeration.',
  })
  @ApiOkResponse({
    description: 'Password reset email sent (if account exists)',
    type: ForgotPasswordResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiTooManyRequestsResponse({ description: 'Too many requests' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    const command: ForgotPasswordCommand = { email: forgotPasswordDto.email };
    return await this.authApplicationService.forgotPassword(command);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password',
    description:
      'Resets the account password using a valid token. ' +
      'All active sessions are immediately invalidated after a successful reset.',
  })
  @ApiOkResponse({ description: 'Password reset successfully', type: ResetPasswordResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or expired token, or password policy violation' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    const command: ResetPasswordCommand = {
      token: resetPasswordDto.token,
      newPassword: resetPasswordDto.newPassword,
    };
    return await this.authApplicationService.resetPassword(command);
  }

  @ApiAuth()
  @Post('change-password')
  @ApiOperation({
    summary: 'Change password',
    description:
      'Changes the account password for an authenticated user. ' +
      'Requires the current password and terminates all other active sessions.',
  })
  @ApiOkResponse({ description: 'Password changed successfully', type: LogoutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid current password' })
  @ApiBadRequestResponse({ description: 'Password policy violation' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async changePassword(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<LogoutResponseDto> {
    const command: ChangePasswordCommand = {
      userId,
      currentPassword: changePasswordDto.currentPassword,
      newPassword: changePasswordDto.newPassword,
    };
    return await this.authApplicationService.changePassword(command, currentSessionId);
  }

  // ─── FEATURE 3: Account Profile ──────────────────────────────────────────

  @ApiAuth()
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the authenticated user profile (userId, username, email, role, isVerified).',
  })
  @ApiOkResponse({ description: 'Current user profile retrieved', type: CurrentUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getCurrentUser(@CurrentUser('sub') userId: string): Promise<CurrentUserResponseDto> {
    return await this.authApplicationService.getCurrentUser(userId);
  }

  // ─── FEATURE 4: Availability Check ───────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('check-email')
  @ApiOperation({
    summary: 'Check email availability',
    description:
      'Checks whether an email address is available for registration. ' +
      'Does not reveal whether an account exists.',
  })
  @ApiOkResponse({ description: 'Email availability checked', type: CheckEmailResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async checkEmail(@Body() dto: CheckEmailDto): Promise<CheckEmailResponseDto> {
    return await this.authApplicationService.checkEmailAvailability(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('check-username')
  @ApiOperation({
    summary: 'Check username availability',
    description:
      'Checks whether a username is available for registration. ' +
      'Does not reveal whether an account exists.',
  })
  @ApiOkResponse({ description: 'Username availability checked', type: CheckUsernameResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async checkUsername(@Body() dto: CheckUsernameDto): Promise<CheckUsernameResponseDto> {
    return await this.authApplicationService.checkUsernameAvailability(dto.username);
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
  @ApiOkResponse({ description: 'Password verification result', type: VerifyPasswordResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async verifyPassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: VerifyPasswordDto,
  ): Promise<VerifyPasswordResponseDto> {
    return await this.authApplicationService.verifyPassword(userId, dto.password);
  }

  // ─── FEATURE 6: Account Deletion ─────────────────────────────────────────

  @ApiAuth()
  @Delete('account')
  @ApiOperation({
    summary: 'Delete account',
    description:
      "Permanently deletes the authenticated user's account after password confirmation. " +
      'All active sessions are terminated immediately.',
  })
  @ApiOkResponse({ description: 'Account deleted', type: DeleteAccountResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated or invalid password' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async deleteAccount(
    @CurrentUser('sub') userId: string,
    @Body() dto: DeleteAccountDto,
    @RequestContext() context: AuthRequestContext,
  ): Promise<DeleteAccountResponseDto> {
    const response = await this.authApplicationService.deleteAccount(
      userId,
      dto.password,
      context.session.ipAddress ?? undefined,
    );
    context.clearRefreshToken();
    return response;
  }
}
