/**
 * Unit tests for `UploadApplicationService`.
 *
 * Coverage:
 *   - happy path: returns `UploadResult` and binds the owner.
 *   - per-purpose size cap is enforced (5 MB avatar / 8 MB quiz).
 *   - per-purpose MIME allowlist is enforced.
 *   - missing file → UPLOAD_NO_FILE.
 *   - storage adapter throw → UPLOAD_PROVIDER_UNAVAILABLE (502).
 *   - bind failure → best-effort adapter.delete + StorageOwnershipBindFailedError.
 *
 * Both the storage adapter and the ownership service are replaced
 * with hand-rolled fakes — the production `StoragePort` and
 * `StorageApplicationService` have small surfaces, so a hand mock
 * beats `jest.fn()` ceremony here.
 */

import {
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import {
  StorageOwnershipBindFailedError,
  type SignedUpload,
  type StoragePort,
  type UploadInput,
  type UploadPurpose,
  type UploadResult,
} from '@/core/storage';

import { UPLOAD_POLICY } from '@/core/storage/domain/upload-policy';
import { UploadApplicationService } from './upload.application.service';
import type { StorageApplicationService } from '@/core/storage';

class FakeStoragePort implements StoragePort {
  readonly uploaded: UploadInput[] = [];
  readonly deleted: string[] = [];
  /** If set, `upload` throws this. */
  uploadError: unknown = null;
  /** If set, `delete` throws this. */
  deleteError: unknown = null;

  upload(input: UploadInput): Promise<UploadResult> {
    if (this.uploadError) {
      return Promise.reject(this.uploadError);
    }
    this.uploaded.push(input);
    const policy = UPLOAD_POLICY[input.purpose];
    const publicId = `${policy.folder}/${input.ownerId}/fake-uuid`;
    return Promise.resolve({
      publicId,
      url: `https://fake.test/${publicId}`,
      bytes: input.bytes,
      format: 'webp',
      width: 1024,
      height: 1024,
    });
  }

  delete(publicId: string): Promise<void> {
    if (this.deleteError) {
      return Promise.reject(this.deleteError);
    }
    this.deleted.push(publicId);
    return Promise.resolve();
  }

  deriveUrl(publicId: string, _purpose: 'avatar' | 'quiz'): string {
    return `https://fake.test/derived/${publicId}`;
  }

  ping(): Promise<void> {
    return Promise.resolve();
  }

  createSignedUpload(input: {
    ownerId: string;
    purpose: UploadPurpose;
    expiresInSeconds: number;
  }): Promise<SignedUpload> {
    const policy = UPLOAD_POLICY[input.purpose];
    const publicId = `${policy.folder}/${input.ownerId}/signed-fake-uuid`;
    const timestamp = Math.floor(Date.now() / 1000) + input.expiresInSeconds;
    return Promise.resolve({
      uploadUrl: `https://fake.test/${publicId}`,
      publicId,
      expiresAt: new Date(timestamp * 1000).toISOString(),
      apiKey: 'fake-key',
      signature: 'fake-signature',
      timestamp,
      folder: policy.folder,
    });
  }

  clear(): void {
    /* no-op */
  }
}

class FakeOwnershipService {
  readonly binds: Array<{ publicId: string; ownerId: string; purpose: 'avatar' | 'quiz' }> = [];
  /** If set, `bindAssetToOwner` throws this. */
  bindError: unknown = null;

  async bindAssetToOwner(input: {
    publicId: string;
    ownerId: string;
    purpose: 'avatar' | 'quiz';
  }): Promise<void> {
    if (this.bindError) {
      throw this.bindError;
    }
    this.binds.push(input);
  }

  // The remaining two operations are not exercised here; the upload
  // service only calls `bindAssetToOwner`. We provide stubs so the
  // shape matches.
  async userOwnsAssetForPurpose(): Promise<boolean> {
    return true;
  }
  async unbindAsset(): Promise<void> {
    /* no-op */
  }
}

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'avatar.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('fake-png-bytes'),
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

function makeService() {
  const storage = new FakeStoragePort();
  const ownership = new FakeOwnershipService();
  // PinoLogger-shaped stub: only the methods the application service
  // actually calls are implemented. Real `PinoLogger` is not needed
  // in unit tests — the logger is exercised at the integration tier.
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  };
  const service = new UploadApplicationService(
    storage,
    ownership as unknown as StorageApplicationService,
    logger as never,
  );
  return { service, storage, ownership, logger };
}

describe('UploadApplicationService', () => {
  describe('happy path', () => {
    it('uploads, binds, and returns the result', async () => {
      const { service, storage, ownership } = makeService();
      const file = makeFile();
      const result = await service.uploadAvatarOrQuizCover({
        ownerId: 'u1',
        purpose: 'avatar',
        file,
      });
      expect(result.publicId).toMatch(/^quiz-app\/avatars\/u1\//);
      expect(storage.uploaded).toHaveLength(1);
      expect(ownership.binds).toEqual([
        { publicId: result.publicId, ownerId: 'u1', purpose: 'avatar' },
      ]);
    });

    it('uses the quiz folder when purpose is quiz', async () => {
      const { service, storage, ownership } = makeService();
      const file = makeFile({ size: 2 * 1024 * 1024, mimetype: 'image/jpeg' });
      const result = await service.uploadAvatarOrQuizCover({
        ownerId: 'u1',
        purpose: 'quiz',
        file,
      });
      expect(result.publicId).toMatch(/^quiz-app\/quizzes\/u1\//);
      expect(storage.uploaded[0].purpose).toBe('quiz');
      expect(ownership.binds[0].purpose).toBe('quiz');
    });
  });

  describe('input validation', () => {
    it('throws UPLOAD_NO_FILE when file is missing', async () => {
      const { service } = makeService();
      await expect(
        service.uploadAvatarOrQuizCover({
          ownerId: 'u1',
          purpose: 'avatar',
          file: undefined,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a MIME outside the avatar allowlist', async () => {
      const { service } = makeService();
      const file = makeFile({ mimetype: 'application/pdf' });
      await expect(
        service.uploadAvatarOrQuizCover({ ownerId: 'u1', purpose: 'avatar', file }),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    });

    it('rejects an oversized avatar (5 MB + 1 byte)', async () => {
      const { service } = makeService();
      const file = makeFile({ size: 5 * 1024 * 1024 + 1 });
      await expect(
        service.uploadAvatarOrQuizCover({ ownerId: 'u1', purpose: 'avatar', file }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('allows an avatar exactly at the cap (5 MB)', async () => {
      const { service, storage } = makeService();
      const file = makeFile({ size: 5 * 1024 * 1024 });
      await service.uploadAvatarOrQuizCover({ ownerId: 'u1', purpose: 'avatar', file });
      expect(storage.uploaded).toHaveLength(1);
    });

    it('rejects an oversized quiz cover (8 MB + 1 byte)', async () => {
      const { service } = makeService();
      const file = makeFile({ size: 8 * 1024 * 1024 + 1, mimetype: 'image/jpeg' });
      await expect(
        service.uploadAvatarOrQuizCover({ ownerId: 'u1', purpose: 'quiz', file }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });
  });

  describe('storage adapter failure', () => {
    it('maps a non-retryable upload error to UPLOAD_PROVIDER_UNAVAILABLE', async () => {
      const { service, storage, ownership } = makeService();
      storage.uploadError = new Error('magic-byte mismatch');
      await expect(
        service.uploadAvatarOrQuizCover({
          ownerId: 'u1',
          purpose: 'avatar',
          file: makeFile(),
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      // No bind was attempted.
      expect(ownership.binds).toEqual([]);
    });
  });

  describe('ownership bind failure', () => {
    it('best-effort deletes the Cloudinary asset and throws StorageOwnershipBindFailedError', async () => {
      const { service, storage, ownership } = makeService();
      ownership.bindError = new StorageOwnershipBindFailedError('collision');
      const file = makeFile();
      await expect(
        service.uploadAvatarOrQuizCover({
          ownerId: 'u1',
          purpose: 'avatar',
          file,
        }),
      ).rejects.toBeInstanceOf(StorageOwnershipBindFailedError);
      // The cleanup must run against the publicId the adapter returned.
      expect(storage.deleted).toHaveLength(1);
    });

    it('still throws when the cleanup itself fails (orphan remains, admin must sweep)', async () => {
      const { service, storage, ownership } = makeService();
      ownership.bindError = new StorageOwnershipBindFailedError('collision');
      storage.deleteError = new Error('Cloudinary 503');
      await expect(
        service.uploadAvatarOrQuizCover({
          ownerId: 'u1',
          purpose: 'avatar',
          file: makeFile(),
        }),
      ).rejects.toBeInstanceOf(StorageOwnershipBindFailedError);
    });

    it('wraps a non-typed repository error in StorageOwnershipBindFailedError', async () => {
      const { service, ownership } = makeService();
      ownership.bindError = new Error('raw drizzle UNIQUE violation');
      await expect(
        service.uploadAvatarOrQuizCover({
          ownerId: 'u1',
          purpose: 'avatar',
          file: makeFile(),
        }),
      ).rejects.toBeInstanceOf(StorageOwnershipBindFailedError);
    });
  });

  describe('signUpload (Phase 7 #1 — presigned URL)', () => {
    it('returns a signed envelope with the expected fields', async () => {
      const { service } = makeService();
      const signed = await service.signUpload({ ownerId: 'u1', purpose: 'avatar' });
      expect(signed.publicId).toMatch(/^quiz-app\/avatars\/u1\//);
      expect(signed.folder).toBe('quiz-app/avatars');
      expect(signed.uploadUrl).toMatch(/^https?:\/\//);
      expect(signed.signature).toBeTruthy();
      expect(signed.timestamp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      // Default 10-minute expiry.
      expect(signed.expiresAt).toMatch(/T/);
    });

    it('passes a custom expiresInSeconds through to the storage port', async () => {
      const storage = new FakeStoragePort();
      const ownership = new FakeOwnershipService();
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const service = new UploadApplicationService(
        storage,
        ownership as unknown as StorageApplicationService,
        logger as never,
      );
      const signed = await service.signUpload({
        ownerId: 'u1',
        purpose: 'quiz',
        expiresInSeconds: 300,
      });
      expect(signed.folder).toBe('quiz-app/quizzes');
      // 5 minutes × 1000 ms — within tolerance.
      const expectedExpiry = Math.floor(Date.now() / 1000) + 300;
      expect(Math.abs(signed.timestamp - expectedExpiry)).toBeLessThanOrEqual(5);
    });
  });
});
