import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/request/login.dto';
import { LoginResponseDto } from './dto/response/login-response.dto';
import { RegisterDto } from './dto/request/register.dto';
import { RegisterResponseDto } from './dto/response/register-response.dto';
import { RefreshTokenResponseDto } from './dto/response/refresh-token-response.dto';
import {
  LoginResult,
  RefreshTokenResult,
  RegisterResult,
  VerifyEmailResult,
} from './types/auth.types';
import { LogoutResponseDto } from './dto/response/logout-response.dto';
import { AuthCookieService } from './services/auth-cookie.service';
import { AuthRequestContextService } from './services/auth-request-context.service';
import { VerifyEmailDto } from './dto/request/verify-email.dto';
import { VerifyEmailResponseDto } from './dto/response/verify-email-response.dto';
import { ResendVerificationDto } from './dto/request/resend-verification.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
    private readonly authRequestContextService: AuthRequestContextService,
  ) {}

  @Post('register')
  @Public()
  async register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
    const registerResult: RegisterResult = await this.authService.register(registerDto);

    return {
      userId: registerResult.userId,
      username: registerResult.username,
      email: registerResult.email,
      createdAt: registerResult.createdAt,
      message: registerResult.message,
    };
  }

  @Post('verify-email')
  @Public()
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    const verifyResult: VerifyEmailResult = await this.authService.verifyEmail(
      verifyEmailDto.token,
    );

    return {
      message: verifyResult.message,
    };
  }

  @Post('resend-verification-email')
  @Public()
  async resendVerificationEmail(
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<VerifyEmailResponseDto> {
    return await this.authService.resendVerificationEmail(resendVerificationDto.email);
  }

  @Post('login')
  @Public()
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const loginResult: LoginResult = await this.authService.login(
      loginDto,
      this.authRequestContextService.getSessionRequestContext(request),
    );
    this.authCookieService.setRefreshTokenCookie(response, loginResult.refreshToken);

    return {
      userId: loginResult.userId,
      username: loginResult.username,
      email: loginResult.email,
      token: {
        accessToken: loginResult.accessToken,
      },
    };
  }

  @Post('refresh-token')
  @Public()
  async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshTokenResponseDto> {
    const refreshToken = this.authCookieService.getRefreshTokenFromCookies(
      request.cookies as unknown,
    );

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token cookie is missing');
    }

    const refreshResult: RefreshTokenResult = await this.authService.refreshToken(
      refreshToken,
      this.authRequestContextService.getSessionRequestContext(request),
    );
    this.authCookieService.setRefreshTokenCookie(response, refreshResult.refreshToken);

    return {
      token: {
        accessToken: refreshResult.accessToken,
      },
    };
  }

  @Post('logout')
  @Public()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResponseDto> {
    const refreshToken = this.authCookieService.getRefreshTokenFromCookies(
      request.cookies as unknown,
    );

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    this.authCookieService.clearRefreshTokenCookie(response);

    return {
      message: 'Logged out successfully',
    };
  }

  @Post('logout-all')
  async logoutAll(
    @CurrentUser('sub') userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResponseDto> {
    await this.authService.logoutAll(userId);
    this.authCookieService.clearRefreshTokenCookie(response);

    return {
      message: 'Logged out from all sessions successfully',
    };
  }
}
