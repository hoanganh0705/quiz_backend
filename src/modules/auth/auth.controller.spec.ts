import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCookieService } from './services/auth-cookie.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authServiceMock = {
    logoutAll: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
  };
  const authCookieServiceMock = {
    setRefreshTokenCookie: jest.fn(),
    clearRefreshTokenCookie: jest.fn(),
    getRefreshTokenFromCookies: jest.fn(),
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
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
