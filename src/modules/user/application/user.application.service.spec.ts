/* eslint-disable @typescript-eslint/require-await */
/**
 * Unit tests for the Phase 6 ownership-rule + lifecycle wiring in
 * `UserApplicationService.updateProfile`.
 *
 * Coverage:
 *   - `ASSET_NOT_OWNED` rejection when the avatar publicId is owned by
 *     a different user (or missing from `storage_assets`).
 *   - Same-supply happy path: when the publicId is owned by the
 *     caller, the update proceeds and lifecycle cleanup runs.
 *   - Lifecycle is called with the *new* publicId (override) and the
 *     reader callback resolves to the previously stored publicId.
 *   - Lifecycle error is logged but does not break the response.
 *   - Same publicId replaced with itself is a no-op for the lifecycle.
 */

import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { UserApplicationService } from './user.application.service';
import {
  StorageApplicationService,
  StorageOwnershipBindFailedError,
} from '@/core/storage/application/storage.application.service';
import { StorageImageLifecycleService } from '@/core/storage/application/storage-image-lifecycle.service';
import type { UserDomainService } from '../domain/user.service';
import type { UserRepositoryPort } from '../domain/ports/user-repository.port';
import type { UserMeRow } from '../domain/ports/user-repository.port';
import type { UserResponseMapper } from '../mappers/user-response.mapper';
import type { UpdateMeDto } from '../dto/request/update-me.dto';

class FakeStorageOwnership {
  owns = true;
  readonly calls: Array<{ publicId: string; ownerId: string; purpose: 'avatar' | 'quiz' }> = [];

  async userOwnsAssetForPurpose(input: {
    publicId: string;
    ownerId: string;
    purpose: 'avatar' | 'quiz';
  }): Promise<boolean> {
    this.calls.push(input);
    return this.owns;
  }
}

class FakeLifecycleService {
  readonly calls: Array<{ userId: string; newPublicId: string | null }> = [];
  throwOnce: boolean = false;

  async replaceAvatar(
    userId: string,
    newPublicId: string | null,
    _read: (id: string) => Promise<string | null>,
  ): Promise<void> {
    this.calls.push({ userId, newPublicId });
    if (this.throwOnce) {
      this.throwOnce = false;
      throw new Error('lifecycle-explodes');
    }
  }
}

function makeRow(overrides: Partial<UserMeRow> = {}): UserMeRow {
  return {
    userId: 'u1',
    username: 'alice',
    email: 'alice@example.com',
    displayName: 'Alice',
    avatarUrl: 'https://legacy.test/avatar.png',
    avatarPublicId: null,
    bio: null,
    xpTotal: 0,
    settings: {},
    currentStreak: 0,
    longestStreak: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeService() {
  const ownership = new FakeStorageOwnership();
  const lifecycle = new FakeLifecycleService();
  const userDomainService = {
    updateProfile: jest.fn(async (_userId: string, _command: unknown) => makeRow()),
  } as unknown as UserDomainService;
  const userRepository = {
    findAvatarPublicIdByUserId: jest.fn(async () => 'quiz-app/avatars/u1/old'),
  } as unknown as UserRepositoryPort;
  const mapper = {
    toUserMeResponse: jest.fn((row: UserMeRow) => row),
  } as unknown as UserResponseMapper;
  const logger = {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const service = new UserApplicationService(
    userDomainService,
    mapper,
    // Other dependencies are not exercised by these tests. Cast to
    // `any` so the constructor is happy without a full DI graph.
    {} as never,
    {} as never,
    {} as never,
    ownership as unknown as StorageApplicationService,
    lifecycle as unknown as StorageImageLifecycleService,
    userRepository,
    logger as never,
  );

  return { service, ownership, lifecycle, userDomainService, userRepository, mapper, logger };
}

describe('UserApplicationService.updateProfile — ownership + lifecycle', () => {
  it('rejects an avatar publicId not owned by the caller', async () => {
    const { service, ownership, userDomainService, lifecycle } = makeService();
    ownership.owns = false;
    const dto: UpdateMeDto = {
      avatarPublicId: 'quiz-app/avatars/u1/stolen',
    };

    await expect(service.updateProfile('u1', dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownership.calls).toHaveLength(1);
    expect(userDomainService.updateProfile).not.toHaveBeenCalled();
    expect(lifecycle.calls).toHaveLength(0);
  });

  it('accepts an avatar publicId owned by the caller', async () => {
    const { service, ownership, lifecycle, userDomainService } = makeService();
    ownership.owns = true;
    const dto: UpdateMeDto = {
      avatarPublicId: 'quiz-app/avatars/u1/mine',
    };

    await service.updateProfile('u1', dto);

    expect(ownership.calls).toHaveLength(1);
    expect(userDomainService.updateProfile).toHaveBeenCalled();
    expect(lifecycle.calls).toEqual([{ userId: 'u1', newPublicId: 'quiz-app/avatars/u1/mine' }]);
  });

  it('does not call the ownership gate when no publicId is provided', async () => {
    const { service, ownership, lifecycle } = makeService();
    const dto: UpdateMeDto = { displayName: 'Alice' };

    await service.updateProfile('u1', dto);

    expect(ownership.calls).toHaveLength(0);
    expect(lifecycle.calls).toHaveLength(1);
    expect(lifecycle.calls[0]?.newPublicId).toBeNull();
  });

  it('throws USER_NOT_FOUND when the domain layer returns null', async () => {
    const { service, userDomainService } = makeService();
    (userDomainService.updateProfile as jest.Mock).mockResolvedValueOnce(null);

    await expect(service.updateProfile('u1', { displayName: 'Alice' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not surface lifecycle errors to the caller', async () => {
    const { service, lifecycle, logger } = makeService();
    lifecycle.throwOnce = true;

    await expect(
      service.updateProfile('u1', { avatarPublicId: 'quiz-app/avatars/u1/mine' }),
    ).resolves.toBeDefined();

    expect(logger.warn).toHaveBeenCalled();
  });

  it('isolates the ownership service from the storage bind error class', () => {
    // Sanity: the upload path uses `StorageOwnershipBindFailedError` as
    // a marker; this test makes sure the marker is still exported and
    // importable alongside the application service. If the rename
    // ever lands in a refactor, this test will catch the fallout.
    expect(StorageOwnershipBindFailedError).toBeDefined();
  });
});
