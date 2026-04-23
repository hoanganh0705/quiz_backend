import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { AuthConfig } from '../auth.config';

describe('TokenService', () => {
  let service: TokenService;

  const jwtServiceMock = {
    signAsync: jest.fn<Promise<string>, [unknown, unknown]>(),
    verifyAsync: jest.fn(),
  };
  const authConfigMock = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenExpiresInSeconds: 900,
    refreshTokenExpiresInSeconds: 2_592_000,
    accessTokenIssuer: 'quiz-api',
    accessTokenAudience: 'quiz-web',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: AuthConfig,
          useValue: authConfigMock,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  it('signs issuer and audience through JWT options instead of duplicating registered claims', async () => {
    jwtServiceMock.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const tokens = await service.issueTokens({
      userId: 'user-1',
      username: 'tester',
      email: 'tester@example.com',
      role: 'user',
    });

    expect(tokens.accessToken).toBe('access-token');
    expect(tokens.refreshToken).toBe('refresh-token');
    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      1,
      {
        sub: 'user-1',
        role: 'user',
      },
      expect.objectContaining({
        secret: authConfigMock.accessTokenSecret,
        issuer: authConfigMock.accessTokenIssuer,
        audience: authConfigMock.accessTokenAudience,
      }),
    );
    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sub: 'user-1',
      }),
      expect.objectContaining({
        secret: authConfigMock.refreshTokenSecret,
        issuer: authConfigMock.accessTokenIssuer,
        audience: authConfigMock.accessTokenAudience,
      }),
    );

    const secondPayload = jwtServiceMock.signAsync.mock.calls[1]?.[0] as { jti?: unknown };
    expect(typeof secondPayload.jti).toBe('string');
  });
});
