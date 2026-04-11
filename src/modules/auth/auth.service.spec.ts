import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getLoggerToken } from 'nestjs-pino';
import { AuthService } from './auth.service';
import { DRIZZLE } from '../../core/database/database.module';
import { AuthConfig } from './auth.config';
import { CryptoService } from '../../common/service/crypto.service';

describe('AuthService', () => {
  let service: AuthService;
  const dbMock = {
    select: jest.fn(),
    insert: jest.fn(),
  };
  const jwtServiceMock = {
    signAsync: jest.fn(),
  };
  const authConfigMock = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenExpiresInSeconds: 60,
    refreshTokenExpiresInSeconds: 120,
    refreshTokenCookieMaxAgeMs: 60_000,
  };
  const cryptoServiceMock = {
    hashSha256: jest.fn(),
  };
  const pinoLoggerMock = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DRIZZLE,
          useValue: dbMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: AuthConfig,
          useValue: authConfigMock,
        },
        {
          provide: CryptoService,
          useValue: cryptoServiceMock,
        },
        {
          provide: getLoggerToken(AuthService.name),
          useValue: pinoLoggerMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
