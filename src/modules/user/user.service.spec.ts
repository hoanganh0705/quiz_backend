import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/database.module';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  const returningMock = jest.fn();
  const setMock = jest.fn(() => ({
    where: jest.fn(() => ({
      returning: returningMock,
    })),
  }));
  const updateMock = jest.fn(() => ({
    set: setMock,
  }));
  const dbMock = {
    select: jest.fn(),
    update: updateMock,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: DRIZZLE,
          useValue: dbMock,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('normalizes blank profile fields to null when updating the current user', async () => {
    returningMock.mockResolvedValueOnce([
      {
        userId: '5d096492-62fb-4f97-8937-5f07c5f10ad8',
        username: 'tester',
        email: 'tester@example.com',
        displayName: null,
        avatarUrl: null,
        bio: null,
        xpTotal: 0,
        currentStreak: 0,
        longestStreak: 0,
        settings: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await expect(
      service.updateMeById('5d096492-62fb-4f97-8937-5f07c5f10ad8', {
        displayName: '   ',
        bio: '',
        avatarUrl: ' ',
      }),
    ).resolves.toMatchObject({
      displayName: null,
      bio: null,
      avatarUrl: null,
      settings: {},
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: null,
        bio: null,
        avatarUrl: null,
      }),
    );
  });

  it('rejects non-object settings payloads defensively', async () => {
    await expect(
      service.updateMeSettingsById('5d096492-62fb-4f97-8937-5f07c5f10ad8', {
        settings: [] as unknown as Record<string, unknown>,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
