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
});
