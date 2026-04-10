import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/request/login.dto';
import { LoginResponseDto } from './dto/response/login-response.dto';
import { RegisterDto } from './dto/request/register.dto';
import { RegisterResponseDto } from './dto/response/register-response.dto';
import { RefreshTokenResponseDto } from './dto/response/refresh-token-response.dto';
import { LoginResult, RefreshTokenResult, RegisterResult } from './types/auth.types';
import { LogoutResponseDto } from './dto/response/logout-response.dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  private getRefreshTokenCookieMaxAgeMs(): number {
    const rawValue = this.configService.get<number>('REFRESH_TOKEN_COOKIE_MAX_AGE_MS');

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('REFRESH_TOKEN_COOKIE_MAX_AGE_MS must be a positive integer');
    }

    return rawValue;
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'strict',
      maxAge: this.getRefreshTokenCookieMaxAgeMs(),
      path: '/',
    });
  }

  private clearRefreshTokenCookie(response: Response): void {
    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'strict',
      path: '/',
    });
  }

  private getRefreshTokenFromCookies(cookies: unknown): string | null {
    if (!cookies || typeof cookies !== 'object') {
      return null;
    }

    const candidate = (cookies as Record<string, unknown>).refreshToken;
    return typeof candidate === 'string' ? candidate : null;
  }

  @Post('refresh-token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshTokenResponseDto> {
    const refreshToken = this.getRefreshTokenFromCookies(request.cookies as unknown);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token cookie is missing');
    }

    const refreshResult: RefreshTokenResult = await this.authService.refreshToken(refreshToken);
    this.setRefreshTokenCookie(response, refreshResult.refreshToken);

    return {
      token: {
        accessToken: refreshResult.accessToken,
      },
    };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResponseDto> {
    const refreshToken = this.getRefreshTokenFromCookies(request.cookies as unknown);

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    this.clearRefreshTokenCookie(response);

    return {
      message: 'Logged out successfully',
    };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const loginResult: LoginResult = await this.authService.login(loginDto);
    this.setRefreshTokenCookie(response, loginResult.refreshToken);

    return {
      userId: loginResult.userId,
      username: loginResult.username,
      email: loginResult.email,
      token: {
        accessToken: loginResult.accessToken,
      },
    };
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegisterResponseDto> {
    const registerResult: RegisterResult = await this.authService.register(registerDto);
    this.setRefreshTokenCookie(response, registerResult.refreshToken);

    return {
      userId: registerResult.userId,
      username: registerResult.username,
      email: registerResult.email,
      createdAt: registerResult.createdAt,
      token: {
        accessToken: registerResult.accessToken,
      },
    };
  }
}
