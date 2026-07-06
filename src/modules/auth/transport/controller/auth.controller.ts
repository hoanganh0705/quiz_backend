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
  ApiTooManyRequestsResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { ApiCookieParam, registerCookieParam } from '@/common/swagger/cookie-params.plugin';
import { ProblemDetailDto, ErrorResponseExamples } from '@/common/swagger/swagger-schemas';
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
import {
  AuthWrappedMessageDto,
  AuthWrappedAvailableDto,
  AuthWrappedValidDto,
  AuthWrappedAccessTokenDto,
  AuthWrappedLoginDto,
  AuthWrappedCurrentUserDto,
  AuthWrappedSecurityDto,
  AuthWrappedSessionListDto,
} from '../../dto/response/auth-response-docs.dto';
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
    example: 'refreshToken=a1b2c3d4...; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000',
  },
};

const clearCookieHeaderSchema = {
  description: 'Cleared refresh token cookie.',
  schema: {
    type: 'string',
    example: 'refreshToken=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  },
};

const forbiddenOptions = {
  description: 'Authenticated user lacks required role or permission',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.forbidden,
};

const notFoundOptions = {
  description: 'The requested resource does not exist or has been deleted',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.notFound,
};

const conflictOptions = {
  description: 'The request conflicts with the current state of the resource',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.conflict,
};

const badRequestOptions = {
  description: 'Request body, query, or params failed validation',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.badRequest,
};

const unauthorizedOptions = {
  description: 'Missing or invalid authentication credentials',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.unauthorized,
};

const tooManyRequestsOptions = {
  description: 'Rate limit exceeded',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.tooManyRequests,
};

const internalErrorOptions = {
  description: 'Unexpected server error',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.internalServerError,
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
  @ApiCreatedResponse({
    description: 'Account created successfully',
    type: AuthWrappedMessageDto,
    example: {
      data: { message: 'Registration successful. Please check your email to verify your account.' },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiConflictResponse(conflictOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOkResponse({
    description: 'Email verified successfully',
    type: AuthWrappedMessageDto,
    example: {
      data: { message: 'Email verified successfully. You can now log in.' },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOkResponse({
    description: 'Verification email sent',
    type: AuthWrappedMessageDto,
    example: {
      data: { message: 'Verification email has been sent. Please check your inbox.' },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
      'Authenticates with email and password and returns a JWT access token. ' +
      'A refresh token cookie is set on success. Device information is collected for security purposes.',
  })
  @ApiOkResponse({
    description: 'Login successful',
    type: AuthWrappedLoginDto,
    headers: { 'Set-Cookie': setCookieHeaderSchema },
    example: {
      data: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        username: 'alice_wonder',
        email: 'alice@example.com',
        accessToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTIxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJyb2xlIjoidXNlciIsImlhdCI6MTcwOTAwMDAwMCwiZXhwIjoxNzA5MDAwNjAwfQ.sig',
        sessionId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiBadRequestResponse(badRequestOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
      'If no account exists for the Google user, one is created automatically. ' +
      'A refresh token cookie is set on success.',
  })
  @ApiOkResponse({
    description: 'Login successful',
    type: AuthWrappedLoginDto,
    headers: { 'Set-Cookie': setCookieHeaderSchema },
    example: {
      data: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        username: 'alice_wonder',
        email: 'alice@example.com',
        accessToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjbiLTIxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJyb2xlIjoidXNlciIsImlhdCI6MTcwOTAwMDAwMCwiZXhwIjoxNzA5MDAwNjAwfQ.sig',
        sessionId: '8e0f8899-9647-62f0-a66d-g29eg3b12cg9',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiBadRequestResponse(badRequestOptions)
  @ApiConflictResponse(conflictOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOkResponse({
    description: 'Token refreshed',
    type: AuthWrappedAccessTokenDto,
    headers: { 'Set-Cookie': setCookieHeaderSchema },
    example: {
      data: {
        accessToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTIxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJyb2xlIjoidXNlciIsImlhdCI6MTcwOTAwMDAwMCwiZXhwIjoxNzA5MDAwNjAwfQ.sig',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiBadRequestResponse(badRequestOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiCookieParam('refreshToken', {
    required: false,
    description: 'HttpOnly refresh token cookie. Cleared on successful logout when present.',
  })
  @Post('logout')
  @ApiOperation({
    summary: 'Log out',
    description:
      'Clears the refresh token cookie. The access token remains valid until it expires. ' +
      'Requires the refresh token cookie to be present.',
  })
  @ApiOkResponse({
    description: 'Logged out successfully',
    type: AuthWrappedMessageDto,
    headers: { 'Set-Cookie': clearCookieHeaderSchema },
    example: {
      data: { message: 'Successfully logged out. Refresh cookie cleared.' },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOkResponse({
    description: 'All sessions terminated',
    type: AuthWrappedMessageDto,
    headers: { 'Set-Cookie': clearCookieHeaderSchema },
    example: {
      data: { message: 'Logged out from all sessions successfully' },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOkResponse({
    description: 'Active sessions retrieved',
    type: AuthWrappedSessionListDto,
    example: {
      data: {
        sessions: [
          {
            sessionId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
            deviceBrowser: 'Chrome',
            deviceOs: 'macOS',
            deviceType: 'desktop',
            ipAddress: '203.0.113.42',
            lastActiveAt: '2026-06-25T10:30:00.000Z',
            isCurrentSession: true,
          },
          {
            sessionId: '8d0e7788-8536-51ef-955c-f18df2a01bf8',
            deviceBrowser: 'Safari',
            deviceOs: 'iOS',
            deviceType: 'mobile',
            ipAddress: '198.51.100.7',
            lastActiveAt: '2026-06-24T18:45:00.000Z',
            isCurrentSession: false,
          },
        ],
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
      'Revokes a specific session by ID. Use this when you want to terminate a single ' +
      'device or browser while keeping the rest of your sessions active. ' +
      'If the target is the current session, the user is logged out (cookie cleared). ' +
      'Otherwise only the target session is invalidated.',
  })
  @ApiOkResponse({
    description: 'Session revoked',
    type: AuthWrappedMessageDto,
    headers: { 'Set-Cookie': clearCookieHeaderSchema },
    example: {
      data: { message: 'Session revoked successfully' },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiNotFoundResponse(notFoundOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
  async revokeSession(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<SessionManagementResultDto> {
    return await this.authApplicationService.revokeSession(userId, sessionId, currentSessionId);
  }

  @ApiAuth()
  @Delete('sessions/others')
  @ApiOperation({
    summary: 'Log out all other devices',
    description:
      'Normalized REST route. Keeps the current session and revokes every other active session for the user.',
  })
  @ApiOkResponse({
    description: 'Other sessions revoked',
    type: AuthWrappedMessageDto,
    example: {
      data: { message: '3 sessions revoked. Current device remains logged in.' },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
  async revokeOtherSessions(
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
  @ApiOkResponse({
    description: 'Security dashboard retrieved',
    type: AuthWrappedSecurityDto,
    example: {
      data: {
        emailVerified: true,
        activeSessionCount: 3,
        lastSuccessfulLoginAt: '2026-06-03T10:00:00.000Z',
        lastPasswordChangeAt: null,
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
    type: AuthWrappedMessageDto,
    example: {
      data: { message: 'If the account exists, a password reset email has been sent.' },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOkResponse({
    description: 'Password reset successfully',
    type: AuthWrappedMessageDto,
    example: {
      data: {
        message: 'Password has been reset successfully. Please log in with your new password.',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOkResponse({
    description: 'Password changed successfully',
    type: AuthWrappedMessageDto,
    example: {
      data: {
        message: 'Password changed successfully. All other sessions have been logged out.',
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiBadRequestResponse(badRequestOptions)
  @ApiConflictResponse(conflictOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
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
  @ApiOkResponse({
    description: 'Current user profile retrieved',
    type: AuthWrappedCurrentUserDto,
    example: {
      data: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        username: 'alice_wonder',
        email: 'alice@example.com',
        role: 'user',
        isVerified: true,
      },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOkResponse({
    description: 'Email availability checked',
    type: AuthWrappedAvailableDto,
    example: {
      data: { available: true },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOkResponse({
    description: 'Username availability checked',
    type: AuthWrappedAvailableDto,
    example: {
      data: { available: false },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiBadRequestResponse(badRequestOptions)
  @ApiTooManyRequestsResponse(tooManyRequestsOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
  @ApiOkResponse({
    description: 'Password verification result',
    type: AuthWrappedValidDto,
    example: {
      data: { valid: true },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
      'All active sessions are terminated immediately and the refresh token cookie is cleared.',
  })
  @ApiOkResponse({
    description: 'Account deleted',
    type: AuthWrappedMessageDto,
    headers: { 'Set-Cookie': clearCookieHeaderSchema },
    example: {
      data: { message: 'Account deleted successfully' },
      meta: { timestamp: '2026-06-25T10:30:00.000Z' },
    },
  })
  @ApiUnauthorizedResponse(unauthorizedOptions)
  @ApiForbiddenResponse(forbiddenOptions)
  @ApiBadRequestResponse(badRequestOptions)
  @ApiConflictResponse(conflictOptions)
  @ApiInternalServerErrorResponse(internalErrorOptions)
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
