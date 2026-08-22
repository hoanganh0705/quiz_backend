/**
 * Unit tests for `StorageImageLifecycleService`.
 *
 * Coverage:
 *   - `replaceAvatar` reads the current `publicId`, deletes the old
 *     Cloudinary asset, and unbinds the `storage_assets` row.
 *   - `replaceAvatar` is a no-op when the column is unchanged
 *     (`current === new`).
 *   - `replaceAvatar` is a no-op when there is no current asset.
 *   - `removeAvatar` clears the column (deletes the old asset).
 *   - `replaceQuizCover` mirrors `replaceAvatar` for quiz covers.
 *   - `removeQuizCover` mirrors `removeAvatar` for quiz covers.
 *   - `deleteQuizCover` is the soft-delete path: even if the cover
 *     would otherwise be replaced, this clears it.
 *   - Cloudinary delete failure is retried; unbind happens regardless.
 *   - Unbind failure is swallowed (so retries with the same `publicId`
 *     will not deadlock on the UNIQUE constraint).
 *   - Injected `readCurrent` callback is honoured.
 */

/* eslint-disable @typescript-eslint/require-await */
import { StorageImageLifecycleService } from './storage-image-lifecycle.service';
import { StorageApplicationService } from './storage.application.service';
import type { StoragePort } from '../storage.port';
import type { SignedUpload, UploadPurpose } from '../storage.types';

class InMemoryStorage implements StoragePort {
  readonly deleted: string[] = [];
  /** failures left to throw on the next .delete() call */
  failures: { publicId: string; error: Error }[] = [];

  upload(): Promise<never> {
    throw new Error('not used in tests');
  }

  async delete(publicId: string): Promise<void> {
    const idx = this.failures.findIndex((f) => f.publicId === publicId);
    if (idx >= 0) {
      const { error } = this.failures.splice(idx, 1)[0];
      throw error;
    }
    this.deleted.push(publicId);
    await Promise.resolve();
  }

  deriveUrl(publicId: string): string {
    return `https://cdn.test/${publicId}`;
  }

  ping(): Promise<void> {
    return Promise.resolve();
  }

  createSignedUpload(input: {
    ownerId: string;
    purpose: UploadPurpose;
    expiresInSeconds: number;
  }): Promise<SignedUpload> {
    const timestamp = Math.floor(Date.now() / 1000) + input.expiresInSeconds;
    return Promise.resolve({
      uploadUrl: 'https://fake.cloudinary.local/image/upload',
      publicId: `quiz-app/${input.purpose === 'avatar' ? 'avatars' : 'quizzes'}/${
        input.ownerId
      }/signed-fake`,
      expiresAt: new Date(timestamp * 1000).toISOString(),
      apiKey: 'fake-key',
      signature: 'fake-signature',
      timestamp,
      folder: input.purpose === 'avatar' ? 'quiz-app/avatars' : 'quiz-app/quizzes',
    });
  }
}

class InMemoryStorageAssetsRepository {
  rows: Array<{ publicId: string; ownerId: string; purpose: 'avatar' | 'quiz' }> = [];

  insert(input: { publicId: string; ownerId: string; purpose: 'avatar' | 'quiz' }) {
    if (this.rows.some((r) => r.publicId === input.publicId)) {
      return Promise.reject(new Error('UNIQUE constraint violation'));
    }
    this.rows.push({ ...input });
    return Promise.resolve();
  }

  existsByPublicIdOwnerAndPurpose() {
    return Promise.resolve(false);
  }

  deleteByPublicId(publicId: string) {
    const idx = this.rows.findIndex((r) => r.publicId === publicId);
    if (idx >= 0) this.rows.splice(idx, 1);
    return Promise.resolve();
  }
}

const pinoLogger = {
  warn: () => undefined,
  info: () => undefined,
  error: () => undefined,
  debug: () => undefined,
  trace: () => undefined,
  fatal: () => undefined,
  setContext: () => undefined,
  serialize: () => ({}),
  assign: () => ({}),
} as unknown as ConstructorParameters<typeof StorageImageLifecycleService>[2];

describe('StorageImageLifecycleService', () => {
  let storage: InMemoryStorage;
  let assets: InMemoryStorageAssetsRepository;
  let application: StorageApplicationService;
  let service: StorageImageLifecycleService;

  beforeEach(() => {
    storage = new InMemoryStorage();
    assets = new InMemoryStorageAssetsRepository();
    application = new StorageApplicationService(assets);
    // The constructor signature requires a `PinoLogger`; we pass the stub
    // above. The lifecycle service only calls `this.logger.warn`, so any
    // shape that satisfies the call is fine.
    service = new StorageImageLifecycleService(storage, application, pinoLogger);
  });

  describe('replaceAvatar', () => {
    it('deletes the previous avatar and unbinds it', async () => {
      await application.bindAssetToOwner({
        publicId: 'quiz-app/avatars/u1/old',
        ownerId: 'u1',
        purpose: 'avatar',
      });
      const readCurrent = async () => 'quiz-app/avatars/u1/old';

      await service.replaceAvatar('u1', 'quiz-app/avatars/u1/new', readCurrent);

      // The lifecycle service deletes the *old* asset and unbinds it.
      // The new row is created earlier by the upload endpoint, not here.
      expect(storage.deleted).toEqual(['quiz-app/avatars/u1/old']);
      expect(assets.rows.map((r) => r.publicId)).toEqual([]);
    });

    it('is a no-op when current === new', async () => {
      await application.bindAssetToOwner({
        publicId: 'quiz-app/avatars/u1/asset',
        ownerId: 'u1',
        purpose: 'avatar',
      });
      const readCurrent = async () => 'quiz-app/avatars/u1/asset';

      await service.replaceAvatar('u1', 'quiz-app/avatars/u1/asset', readCurrent);

      expect(storage.deleted).toEqual([]);
      expect(assets.rows.map((r) => r.publicId)).toEqual(['quiz-app/avatars/u1/asset']);
    });

    it('is a no-op when there is no current avatar', async () => {
      const readCurrent = async () => null;

      await service.replaceAvatar('u1', 'quiz-app/avatars/u1/new', readCurrent);

      expect(storage.deleted).toEqual([]);
      expect(assets.rows).toEqual([]);
    });

    it('honours the readCurrent callback', async () => {
      const calls: string[] = [];
      const readCurrent = async (userId: string) => {
        calls.push(userId);
        return null;
      };

      await service.replaceAvatar('u-7', null, readCurrent);

      expect(calls).toEqual(['u-7']);
    });
  });

  describe('removeAvatar', () => {
    it('clears the avatar and unbinds the old asset', async () => {
      await application.bindAssetToOwner({
        publicId: 'quiz-app/avatars/u1/old',
        ownerId: 'u1',
        purpose: 'avatar',
      });
      const readCurrent = async () => 'quiz-app/avatars/u1/old';

      await service.removeAvatar('u1', readCurrent);

      expect(storage.deleted).toEqual(['quiz-app/avatars/u1/old']);
      expect(assets.rows).toEqual([]);
    });
  });

  describe('replaceQuizCover', () => {
    it('deletes the previous cover and unbinds it', async () => {
      await application.bindAssetToOwner({
        publicId: 'quiz-app/quizzes/u1/old',
        ownerId: 'u1',
        purpose: 'quiz',
      });
      const readCurrent = async () => 'quiz-app/quizzes/u1/old';

      await service.replaceQuizCover('q1', 'quiz-app/quizzes/u1/new', readCurrent);

      expect(storage.deleted).toEqual(['quiz-app/quizzes/u1/old']);
      expect(assets.rows.map((r) => r.publicId)).toEqual([]);
    });
  });

  describe('removeQuizCover', () => {
    it('clears the cover and unbinds the old asset', async () => {
      await application.bindAssetToOwner({
        publicId: 'quiz-app/quizzes/u1/old',
        ownerId: 'u1',
        purpose: 'quiz',
      });
      const readCurrent = async () => 'quiz-app/quizzes/u1/old';

      await service.removeQuizCover('q1', readCurrent);

      expect(storage.deleted).toEqual(['quiz-app/quizzes/u1/old']);
      expect(assets.rows).toEqual([]);
    });
  });

  describe('deleteQuizCover', () => {
    it('clears the cover when the quiz is soft-deleted', async () => {
      await application.bindAssetToOwner({
        publicId: 'quiz-app/quizzes/u1/old',
        ownerId: 'u1',
        purpose: 'quiz',
      });
      const readCurrent = async () => 'quiz-app/quizzes/u1/old';

      await service.deleteQuizCover('q1', readCurrent);

      expect(storage.deleted).toEqual(['quiz-app/quizzes/u1/old']);
      expect(assets.rows).toEqual([]);
    });

    it('is a no-op when there is no cover', async () => {
      const readCurrent = async () => null;

      await service.deleteQuizCover('q1', readCurrent);

      expect(storage.deleted).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('retries Cloudinary delete on a transient failure', async () => {
      storage.failures.push({
        publicId: 'quiz-app/avatars/u1/old',
        error: new Error('transient'),
      });
      await application.bindAssetToOwner({
        publicId: 'quiz-app/avatars/u1/old',
        ownerId: 'u1',
        purpose: 'avatar',
      });
      const readCurrent = async () => 'quiz-app/avatars/u1/old';

      await service.replaceAvatar('u1', 'quiz-app/avatars/u1/new', readCurrent);

      // The failed attempt should be drained by the retry; the next call
      // succeeds and appends to `deleted`.
      expect(storage.deleted).toEqual(['quiz-app/avatars/u1/old']);
      expect(assets.rows.map((r) => r.publicId)).toEqual([]);
    });

    it('unbinds even when delete fails permanently', async () => {
      // Two failures means the retry also fails — total attempts = 2.
      storage.failures.push(
        { publicId: 'quiz-app/avatars/u1/old', error: new Error('1') },
        { publicId: 'quiz-app/avatars/u1/old', error: new Error('2') },
      );
      await application.bindAssetToOwner({
        publicId: 'quiz-app/avatars/u1/old',
        ownerId: 'u1',
        purpose: 'avatar',
      });
      const readCurrent = async () => 'quiz-app/avatars/u1/old';

      await service.replaceAvatar('u1', 'quiz-app/avatars/u1/new', readCurrent);

      expect(storage.deleted).toEqual([]);
      expect(assets.rows.map((r) => r.publicId)).toEqual([]);
    });

    it('does not throw when unbind fails', async () => {
      // Force the inner unbind to throw so we can verify the catch-all.
      jest.spyOn(application, 'unbindAsset').mockRejectedValueOnce(new Error('unbind-failed'));
      await application.bindAssetToOwner({
        publicId: 'quiz-app/avatars/u1/old',
        ownerId: 'u1',
        purpose: 'avatar',
      });
      const readCurrent = async () => 'quiz-app/avatars/u1/old';

      await expect(
        service.replaceAvatar('u1', 'quiz-app/avatars/u1/new', readCurrent),
      ).resolves.toBeUndefined();
    });
  });
});
