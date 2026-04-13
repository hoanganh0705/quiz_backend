import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCookieService } from './services/auth-cookie.service';
import { AuthRequestContextService } from './services/auth-request-context.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authServiceMock = {
    logoutAll: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
  };
  const authCookieServiceMock = {
    setRefreshTokenCookie: jest.fn(),
    clearRefreshTokenCookie: jest.fn(),
    getRefreshTokenFromCookies: jest.fn(),
  };
  const authRequestContextServiceMock = {
    getSessionRequestContext: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: AuthCookieService,
          useValue: authCookieServiceMock,
        },
        {
          provide: AuthRequestContextService,
          useValue: authRequestContextServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
