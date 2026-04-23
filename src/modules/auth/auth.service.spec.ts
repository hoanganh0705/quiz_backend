import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { AuthService } from './auth.service';
import { CryptoService } from './services/crypto.service';
import { UserRepository } from '../../core/database/repositories/user.repository';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { SecurityService } from './services/security.service';
import { AuthConfig } from './auth.config';
import { EmailService } from '@/modules/email/email.service';
import type { RefreshTokenPayload, SessionRequestContext } from './types/auth.types';
import type { SessionRecord } from '@/core/database/repositories/user-session.repository';

describe('AuthService', () => {
  let service: AuthService;
  const userRepositoryMock = {
    ensureEmailAndUsernameAvailable: jest.fn(),
    createUser: jest.fn(),
    findActiveByEmailWithPassword: jest.fn(),
    findActiveVerificationStatusByEmail: jest.fn(),
    findActiveIdentityById: jest.fn(),
    setEmailVerificationToken: jest.fn(),
    findUserByActiveVerificationToken: jest.fn(),
    markEmailAsVerified: jest.fn(),
  };
  const tokenServiceMock = {
    issueTokens: jest.fn(),
    verifyRefreshToken: jest.fn(),
    tryVerifyRefreshToken: jest.fn(),
  };
  const sessionServiceMock = {
    createSession: jest.fn(),
    getSessionByJtiAndUserId: jest.fn(),
    findLatestActiveSessionByUserId: jest.fn(),
    rotateSession: jest.fn(),
    revokeSessionByJti: jest.fn(),
    revokeSessionByRefreshTokenHash: jest.fn(),
    revokeAllActiveSessions: jest.fn(),
  };
  const securityServiceMock = {
    enforceLoginRateLimit: jest.fn(),
    enforceRefreshRateLimit: jest.fn(),
    evaluateSessionBinding: jest.fn(),
    canUseRefreshReuseGraceWindow: jest.fn(),
    handleGraceWindowReuse: jest.fn(),
  };
  const cryptoServiceMock = {
    hashSha256: jest.fn(),
  };
  const pinoLoggerMock = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const authConfigMock = {
    emailVerificationTokenTtlSeconds: 1800,
  };
  const emailServiceMock = {
    enqueueVerificationEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: userRepositoryMock,
        },
        {
          provide: TokenService,
          useValue: tokenServiceMock,
        },
        {
          provide: SessionService,
          useValue: sessionServiceMock,
        },
        {
          provide: SecurityService,
          useValue: securityServiceMock,
        },
        {
          provide: CryptoService,
          useValue: cryptoServiceMock,
        },
        {
          provide: getLoggerToken(AuthService.name),
          useValue: pinoLoggerMock,
        },
        {
          provide: AuthConfig,
          useValue: authConfigMock,
        },
        {
          provide: EmailService,
          useValue: emailServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('handles one refresh-token grace-window reuse without double-counting it as abuse', async () => {
    const oldRefreshToken = 'old-refresh-token';
    const oldRefreshTokenHash = 'a'.repeat(64);
    const newRefreshTokenHash = 'b'.repeat(64);
    const payload: RefreshTokenPayload = {
      sub: 'user-1',
      jti: 'old-jti',
      iss: 'quiz-api',
      aud: 'quiz-web',
      exp: Math.floor(Date.now() / 1000) + 60,
      iat: Math.floor(Date.now() / 1000) - 60,
    };
    const context: SessionRequestContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      deviceBrowser: 'chrome',
      deviceOs: 'linux',
      deviceType: 'desktop',
    };
    const latestSession: SessionRecord = {
      sessionId: 'session-1',
      jti: 'new-jti',
      userId: 'user-1',
      refreshTokenHash: newRefreshTokenHash,
      ipAddress: context.ipAddress,
      deviceBrowser: context.deviceBrowser,
      deviceOs: context.deviceOs,
      deviceType: context.deviceType,
      lastUsedAt: new Date().toISOString(),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const issuedTokens = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      refreshTokenJti: 'newer-jti',
    };

    tokenServiceMock.verifyRefreshToken.mockResolvedValue(payload);
    securityServiceMock.enforceRefreshRateLimit.mockResolvedValue(undefined);
    cryptoServiceMock.hashSha256.mockReturnValue(oldRefreshTokenHash);
    sessionServiceMock.getSessionByJtiAndUserId.mockResolvedValue(null);
    sessionServiceMock.findLatestActiveSessionByUserId.mockResolvedValue(latestSession);
    securityServiceMock.canUseRefreshReuseGraceWindow.mockReturnValue(true);
    securityServiceMock.handleGraceWindowReuse.mockResolvedValue(true);
    securityServiceMock.evaluateSessionBinding.mockReturnValue({ shouldReject: false });
    userRepositoryMock.findActiveIdentityById.mockResolvedValue({
      userId: 'user-1',
      username: 'tester',
      email: 'tester@example.com',
      role: 'user',
    });
    tokenServiceMock.issueTokens.mockResolvedValue(issuedTokens);
    sessionServiceMock.rotateSession.mockResolvedValue(undefined);

    await expect(service.refreshToken(oldRefreshToken, context)).resolves.toEqual(issuedTokens);

    expect(securityServiceMock.canUseRefreshReuseGraceWindow).toHaveBeenCalledTimes(1);
    expect(securityServiceMock.handleGraceWindowReuse).toHaveBeenCalledTimes(1);
    expect(sessionServiceMock.rotateSession).toHaveBeenCalledWith(
      latestSession.sessionId,
      issuedTokens,
      context,
      expect.any(String),
    );
  });
});
