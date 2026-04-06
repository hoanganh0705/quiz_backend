import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getLoggerToken } from 'nestjs-pino';
import { AuthService } from './auth.service';
import { DRIZZLE } from '../../core/database/database.module';

describe('AuthService', () => {
  let service: AuthService;
  const dbMock = {
    select: jest.fn(),
    insert: jest.fn(),
  };
  const jwtServiceMock = {
    signAsync: jest.fn(),
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
