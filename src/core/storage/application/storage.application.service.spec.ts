/**
 * Unit tests for `StorageApplicationService`.
 *
 * Coverage:
 *   - `bindAssetToOwner` is a single insert; throws
 *     `StorageOwnershipBindFailedError` on a repository throw.
 *   - `userOwnsAssetForPurpose` returns true only when
 *     (publicId, ownerId, purpose) matches; returns false for missing
 *     rows, wrong owners, and wrong purposes.
 *   - `unbindAsset` is idempotent and forwards to the repository.
 *
 * Repository is a hand-rolled mock — the production port is small
 * enough that a hand mock is clearer than `jest.fn()` ceremony.
 */

import {
  StorageApplicationService,
  StorageOwnershipBindFailedError,
} from './storage.application.service';
import type { StorageAssetsRepositoryPort } from '../domain/ports/storage-assets-repository.port';
import type { UploadPurpose } from '../storage.types';

class InMemoryStorageAssetsRepository implements StorageAssetsRepositoryPort {
  readonly rows: Array<{ publicId: string; ownerId: string; purpose: UploadPurpose }> = [];

  insert(input: { publicId: string; ownerId: string; purpose: UploadPurpose }): Promise<void> {
    if (this.rows.some((r) => r.publicId === input.publicId)) {
      return Promise.reject(new Error('UNIQUE constraint violation'));
    }
    this.rows.push({ ...input });
    return Promise.resolve();
  }

  existsByPublicIdOwnerAndPurpose(input: {
    publicId: string;
    ownerId: string;
    purpose: UploadPurpose;
  }): Promise<boolean> {
    return Promise.resolve(
      this.rows.some(
        (r) =>
          r.publicId === input.publicId &&
          r.ownerId === input.ownerId &&
          r.purpose === input.purpose,
      ),
    );
  }

  deleteByPublicId(publicId: string): Promise<void> {
    const idx = this.rows.findIndex((r) => r.publicId === publicId);
    if (idx >= 0) {
      this.rows.splice(idx, 1);
    }
    return Promise.resolve();
  }
}

describe('StorageApplicationService', () => {
  let repo: InMemoryStorageAssetsRepository;
  let service: StorageApplicationService;

  beforeEach(() => {
    repo = new InMemoryStorageAssetsRepository();
    service = new StorageApplicationService(repo);
  });

  describe('bindAssetToOwner', () => {
    it('inserts a row', async () => {
      await service.bindAssetToOwner({
        publicId: 'quiz-app/avatars/u1/u2',
        ownerId: 'u1',
        purpose: 'avatar',
      });
      expect(repo.rows).toEqual([
        { publicId: 'quiz-app/avatars/u1/u2', ownerId: 'u1', purpose: 'avatar' },
      ]);
    });

    it('wraps repository errors in StorageOwnershipBindFailedError', async () => {
      // Pre-populate so the next insert collides.
      await repo.insert({
        publicId: 'quiz-app/avatars/u1/u2',
        ownerId: 'u1',
        purpose: 'avatar',
      });
      await expect(
        service.bindAssetToOwner({
          publicId: 'quiz-app/avatars/u1/u2',
          ownerId: 'u1',
          purpose: 'avatar',
        }),
      ).rejects.toBeInstanceOf(StorageOwnershipBindFailedError);
    });

    it('preserves the underlying error as `cause`', async () => {
      await repo.insert({
        publicId: 'p',
        ownerId: 'u',
        purpose: 'avatar',
      });
      const err = await service
        .bindAssetToOwner({ publicId: 'p', ownerId: 'u', purpose: 'avatar' })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(StorageOwnershipBindFailedError);
      expect((err as StorageOwnershipBindFailedError).cause).toBeInstanceOf(Error);
    });
  });

  describe('userOwnsAssetForPurpose', () => {
    beforeEach(async () => {
      await service.bindAssetToOwner({
        publicId: 'quiz-app/avatars/u1/u2',
        ownerId: 'u1',
        purpose: 'avatar',
      });
    });

    it('returns true for the owning user on the right purpose', async () => {
      await expect(
        service.userOwnsAssetForPurpose({
          publicId: 'quiz-app/avatars/u1/u2',
          ownerId: 'u1',
          purpose: 'avatar',
        }),
      ).resolves.toBe(true);
    });

    it('returns false for a different user (no oracle, same response)', async () => {
      await expect(
        service.userOwnsAssetForPurpose({
          publicId: 'quiz-app/avatars/u1/u2',
          ownerId: 'u2',
          purpose: 'avatar',
        }),
      ).resolves.toBe(false);
    });

    it('returns false when purpose does not match (cross-purpose reuse)', async () => {
      await expect(
        service.userOwnsAssetForPurpose({
          publicId: 'quiz-app/avatars/u1/u2',
          ownerId: 'u1',
          purpose: 'quiz',
        }),
      ).resolves.toBe(false);
    });

    it('returns false for a publicId that has never existed', async () => {
      await expect(
        service.userOwnsAssetForPurpose({
          publicId: 'quiz-app/avatars/u1/forged',
          ownerId: 'u1',
          purpose: 'avatar',
        }),
      ).resolves.toBe(false);
    });
  });

  describe('unbindAsset', () => {
    it('removes the row', async () => {
      await service.bindAssetToOwner({
        publicId: 'p',
        ownerId: 'u',
        purpose: 'avatar',
      });
      await service.unbindAsset('p');
      expect(repo.rows).toEqual([]);
    });

    it('is idempotent (no error when the row does not exist)', async () => {
      await expect(service.unbindAsset('does-not-exist')).resolves.toBeUndefined();
    });
  });
});
