import { Body, Controller, Post, UseFilters, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
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
import { RefreshToken } from '../decorators/refresh-token.decorator';
import { RequestContext } from '../decorators/request-context.decorator';
import { RequestContextInterceptor } from '../interceptors/request-context.interceptor';
import { RefreshTokenInterceptor } from '../interceptors/refresh-token.interceptor';
import { AuthDomainExceptionFilter } from '../filters/auth-domain-exception.filter';
import type { AuthRequestContext } from '../../types/auth-context.types';

@Controller('auth')
@UseInterceptors(RequestContextInterceptor, RefreshTokenInterceptor)
@UseFilters(AuthDomainExceptionFilter)
export class AuthController {
  constructor(private readonly authApplicationService: AuthApplicationService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authApplicationService.register(registerDto);
  }

  @Post('verify-email')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    return this.authApplicationService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification-email')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resendVerificationEmail(
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<VerifyEmailResponseDto> {
    return this.authApplicationService.resendVerificationEmail(resendVerificationDto);
  }

  @Post('login')
  @Public()
  async login(
    @Body() loginDto: LoginDto,
    @RequestContext() context: AuthRequestContext,
  ): Promise<LoginResponseDto> {
    return this.authApplicationService.login(loginDto, context);
  }

  @Post('refresh-token')
  @Public()
  async refreshToken(
    @RefreshToken({ required: true }) refreshToken: string,
    @RequestContext() context: AuthRequestContext,
  ): Promise<RefreshTokenResponseDto> {
    return this.authApplicationService.refreshToken(refreshToken, context);
  }

  @Post('logout')
  // Intentionally public: allows clients to clear refresh cookies even if the access token is expired.
  @Public()
  async logout(
    @RefreshToken() refreshToken: string | null,
    @RequestContext() context: AuthRequestContext,
  ): Promise<LogoutResponseDto> {
    return this.authApplicationService.logout(refreshToken, context);
  }

  @Post('logout-all')
  async logoutAll(
    @CurrentUser('sub') userId: string,
    @RequestContext() context: AuthRequestContext,
  ): Promise<LogoutResponseDto> {
    return this.authApplicationService.logoutAll(userId, context);
  }
}
