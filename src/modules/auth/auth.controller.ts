import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/request/login.dto';
import { LoginResponseDto } from './dto/response/login-response.dto';
import { RegisterDto } from './dto/request/register.dto';
import { RegisterResponseDto } from './dto/response/register-response.dto';
import { RefreshTokenResponseDto } from './dto/response/refresh-token-response.dto';
import { LoginResult, RefreshTokenResult, RegisterResult } from './types/auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'strict',
      maxAge: AuthService.REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
      path: '/auth/refresh-token',
    });
  }

  private clearRefreshTokenCookie(response: Response): void {
    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'strict',
      path: '/auth/refresh-token',
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
  ): Promise<void> {
    const refreshToken = this.getRefreshTokenFromCookies(request.cookies as unknown);

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    this.clearRefreshTokenCookie(response);
  }

  @Post('login')
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
