import { Body, Controller, Post, UseFilters, UseInterceptors } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
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
import type { AuthRequestContext } from '../types/auth-http-context.types';
import type {
  LoginCommand,
  RegisterCommand,
  ResendVerificationEmailCommand,
  VerifyEmailCommand,
} from '../../domain/types/auth-commands';

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
    description: 'Authenticates with email and password and returns a JWT access token.',
  })
  @ApiOkResponse({ description: 'Login successful', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async login(
    @Body() loginDto: LoginDto,
    @RequestContext() context: AuthRequestContext,
  ): Promise<LoginResponseDto> {
    const command: LoginCommand = {
      email: loginDto.email,
      password: loginDto.password,
    };

    const loginResult: { response: LoginResponseDto; refreshToken: string } =
      await this.authApplicationService.login(command, context.session);
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
      'Clears the refresh token cookie. The access token remains valid until it expires.',
  })
  @ApiOkResponse({ description: 'Logged out successfully', type: LogoutResponseDto })
  async logout(
    @RefreshToken() refreshToken: string | null,
    @RequestContext() context: AuthRequestContext,
  ): Promise<LogoutResponseDto> {
    const response = await this.authApplicationService.logout(refreshToken);
    context.clearRefreshToken();
    return response;
  }

  @Post('logout-all')
  @ApiOperation({
    summary: 'Log out all sessions',
    description:
      'Invalidates ALL active sessions for the authenticated user and clears the refresh token cookie.',
  })
  @ApiOkResponse({ description: 'All sessions terminated', type: LogoutResponseDto })
  async logoutAll(
    @CurrentUser('sub') userId: string,
    @RequestContext() context: AuthRequestContext,
  ): Promise<LogoutResponseDto> {
    const response = await this.authApplicationService.logoutAll(userId);
    context.clearRefreshToken();
    return response;
  }
}
