import type { Request, Response } from 'express';
import { UserController } from './user.controller';
import { UserProfilePrivateError } from '@/modules/user/domain/errors';
import type { UserLookupResponseDto } from '../../dto/response/user-lookup.dto';

describe('UserController.getUserByUsername — privacy + throttle', () => {
  const buildController = () => {
    const userApplicationService = {
      getUserByUsername: jest.fn(),
    };
    const presenter = {
      getUserByUsername: jest.fn(),
    };
    const controller = new UserController(
      userApplicationService as never,
      presenter as never,
      { getRecommendedQuizzes: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { controller, userApplicationService, presenter };
  };

  it('decorates the route with @Throttle({ default: { limit: 60, ttl: 60_000 } })', () => {
    const proto = UserController.prototype as unknown as Record<string, unknown>;
    const handler: object = proto['getUserByUsername'] as object;
    const readMeta = (key: string): number => {
      const value: unknown = Reflect.getMetadata(key, handler);
      return value as number;
    };
    const limit = readMeta('THROTTLER:LIMITdefault');
    const ttl = readMeta('THROTTLER:TTLdefault');
    expect(limit).toBe(60);
    expect(ttl).toBe(60_000);
  });

  it('returns a presenter envelope for an existing user', async () => {
    const { controller, userApplicationService, presenter } = buildController();
    const row: UserLookupResponseDto = {
      id: '0190f8e8-c1d3-7d8e-b123-456789abcdef',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: null,
      isVerified: true,
    };
    userApplicationService.getUserByUsername.mockResolvedValue(row);
    presenter.getUserByUsername.mockReturnValue({ data: row, meta: { timestamp: 'x' } });

    const result = await controller.getUserByUsername('alice');

    expect(userApplicationService.getUserByUsername).toHaveBeenCalledWith('alice');
    expect(presenter.getUserByUsername).toHaveBeenCalledWith(row);
    expect(result).toEqual({ data: row, meta: { timestamp: 'x' } });
  });

  it('propagates a UserProfilePrivateError so the global filter maps it to 403', async () => {
    const { controller, userApplicationService } = buildController();
    userApplicationService.getUserByUsername.mockRejectedValue(
      new UserProfilePrivateError('0190f8e8-c1d3-7d8e-b123-456789abcdef'),
    );

    await expect(controller.getUserByUsername('alice')).rejects.toBeInstanceOf(
      UserProfilePrivateError,
    );
  });
});
