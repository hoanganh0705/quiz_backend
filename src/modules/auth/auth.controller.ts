import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/request/login.dto';
import { LoginResponseDto } from './dto/response/login-response.dto';
import { RegisterDto } from './dto/request/register.dto';
import { RegisterResponseDto } from './dto/response/register-response.dto';
import { RefreshTokenResponseDto } from './dto/response/refresh-token-response.dto';
import { LoginResult, RefreshTokenResult, RegisterResult } from './types/auth.types';
import { SessionRequestContext } from './types/auth.types';
import { LogoutResponseDto } from './dto/response/logout-response.dto';
import { AuthCookieService } from './services/auth-cookie.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  private extractIpAddress(request: Request): string | null {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      const [firstIp] = forwardedFor.split(',');
      return firstIp?.trim() || null;
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor[0]?.trim() || null;
    }

    return request.ip || null;
  }

  private getSessionRequestContext(request: Request): SessionRequestContext {
    const userAgentHeader = request.headers['user-agent'];

    return {
      ipAddress: this.extractIpAddress(request),
      userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : null,
    };
  }

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegisterResponseDto> {
    const registerResult: RegisterResult = await this.authService.register(
      registerDto,
      this.getSessionRequestContext(request),
    );
    this.authCookieService.setRefreshTokenCookie(response, registerResult.refreshToken);

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

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const loginResult: LoginResult = await this.authService.login(
      loginDto,
      this.getSessionRequestContext(request),
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
      this.getSessionRequestContext(request),
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
