import { InternalServerErrorException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { R2StorageAdapter } from './r2.adapter';
import { UPLOAD_POLICY } from '../../domain/upload-policy';
import type { UploadInput } from '../../storage.types';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue('https://mock-presigned-url.r2.cloudflarestorage.com/put'),
}));

const OWNER = '0190b1c2-7f3a-7aaa-bbbb-cccccccccccc';

function makePinoLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  };
}

describe('R2StorageAdapter', () => {
  let s3SendMock: jest.Mock;
  let mockS3Client: S3Client;
  let mockLogger: ReturnType<typeof makePinoLogger>;
  const testConfig = {
    accountId: 'test-account-id',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'quiz-app-assets',
    endpoint: 'https://test-account-id.r2.cloudflarestorage.com',
    publicUrl: 'https://images.example.com',
    folder: 'quiz-app',
  };

  beforeEach(() => {
    s3SendMock = jest.fn().mockResolvedValue({});
    mockS3Client = {
      send: s3SendMock,
    } as unknown as S3Client;
    mockLogger = makePinoLogger();
  });

  function createAdapter(configOverrides = {}) {
    return new R2StorageAdapter(
      mockS3Client,
      { ...testConfig, ...configOverrides },
      mockLogger as never,
    );
  }

  describe('upload', () => {
    it('sends PutObjectCommand with correct parameters for avatar', async () => {
      const adapter = createAdapter();
      const input: UploadInput = {
        buffer: Buffer.from('fake-avatar-bytes'),
        mime: 'image/png',
        bytes: 17,
        purpose: 'avatar',
        ownerId: OWNER,
      };

      const result = await adapter.upload(input);

      expect(s3SendMock).toHaveBeenCalledTimes(1);
      const command = s3SendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input.Bucket).toBe('quiz-app-assets');
      expect(command.input.Key).toMatch(
        new RegExp(`^${UPLOAD_POLICY.avatar.folder}/${OWNER}/[0-9a-f-]{36}$`),
      );
      expect(command.input.ContentType).toBe('image/png');
      expect(command.input.ContentLength).toBe(17);
      expect(command.input.CacheControl).toBe('public, max-age=31536000, immutable');

      expect(result).toEqual({
        publicId: command.input.Key,
        url: `https://images.example.com/${command.input.Key}`,
        bytes: 17,
        format: 'png',
        width: 512,
        height: 512,
      });
    });

    it('sends PutObjectCommand with correct parameters for quiz cover', async () => {
      const adapter = createAdapter();
      const input: UploadInput = {
        buffer: Buffer.from('fake-quiz-cover-bytes'),
        mime: 'image/webp',
        bytes: 21,
        purpose: 'quiz',
        ownerId: OWNER,
      };

      const result = await adapter.upload(input);

      expect(s3SendMock).toHaveBeenCalledTimes(1);
      const command = s3SendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input.Key).toMatch(
        new RegExp(`^${UPLOAD_POLICY.quiz.folder}/${OWNER}/[0-9a-f-]{36}$`),
      );
      expect(result.width).toBe(1600);
      expect(result.height).toBe(900);
      expect(result.format).toBe('webp');
    });

    it('logs warning and throws InternalServerErrorException on S3 failure', async () => {
      const adapter = createAdapter();
      s3SendMock.mockRejectedValueOnce(new Error('S3 network timeout'));

      const input: UploadInput = {
        buffer: Buffer.from('test'),
        mime: 'image/png',
        bytes: 4,
        purpose: 'avatar',
        ownerId: OWNER,
      };

      await expect(adapter.upload(input)).rejects.toThrow(InternalServerErrorException);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'r2_upload_failed',
          error: 'S3 network timeout',
        }),
      );
    });
  });

  describe('delete', () => {
    it('sends DeleteObjectCommand with correct bucket and key', async () => {
      const adapter = createAdapter();
      await adapter.delete('quiz-app/avatars/user-1/uuid-1');

      expect(s3SendMock).toHaveBeenCalledTimes(1);
      const command = s3SendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input.Bucket).toBe('quiz-app-assets');
      expect(command.input.Key).toBe('quiz-app/avatars/user-1/uuid-1');
    });

    it('swallows S3 errors safely and logs a warning', async () => {
      const adapter = createAdapter();
      s3SendMock.mockRejectedValueOnce(new Error('Delete forbidden'));

      await expect(adapter.delete('quiz-app/avatars/user-1/uuid-1')).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'r2_destroy_failed',
          publicId: 'quiz-app/avatars/user-1/uuid-1',
        }),
      );
    });
  });

  describe('deriveUrl', () => {
    it('returns full HTTP/HTTPS URLs unchanged', () => {
      const adapter = createAdapter();
      expect(adapter.deriveUrl('https://legacy.example.com/photo.jpg', 'avatar')).toBe(
        'https://legacy.example.com/photo.jpg',
      );
    });

    it('returns publicUrl prefixed URL when publicUrl is configured', () => {
      const adapter = createAdapter({ publicUrl: 'https://images.example.com' });
      expect(adapter.deriveUrl('quiz-app/avatars/u/uuid', 'avatar')).toBe(
        'https://images.example.com/quiz-app/avatars/u/uuid',
      );
    });

    it('falls back to endpoint-based URL when publicUrl is not set', () => {
      const adapter = createAdapter({ publicUrl: '' });
      expect(adapter.deriveUrl('quiz-app/avatars/u/uuid', 'avatar')).toBe(
        'https://test-account-id.r2.cloudflarestorage.com/quiz-app-assets/quiz-app/avatars/u/uuid',
      );
    });
  });

  describe('ping', () => {
    it('sends HeadBucketCommand and resolves on success', async () => {
      const adapter = createAdapter();
      await expect(adapter.ping()).resolves.toBeUndefined();

      expect(s3SendMock).toHaveBeenCalledTimes(1);
      const command = s3SendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(HeadBucketCommand);
      expect(command.input.Bucket).toBe('quiz-app-assets');
    });

    it('logs warning and re-throws when HeadBucket fails', async () => {
      const adapter = createAdapter();
      const err = new Error('Bucket not found');
      s3SendMock.mockRejectedValueOnce(err);

      await expect(adapter.ping()).rejects.toThrow('Bucket not found');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'r2_storage_ping_failed',
          message: 'Bucket not found',
        }),
      );
    });
  });

  describe('createSignedUpload', () => {
    it('returns signed envelope with presigned PUT URL', async () => {
      const adapter = createAdapter();
      const result = await adapter.createSignedUpload({
        ownerId: OWNER,
        purpose: 'avatar',
        expiresInSeconds: 300,
      });

      expect(result.uploadUrl).toBe('https://mock-presigned-url.r2.cloudflarestorage.com/put');
      expect(result.publicId).toMatch(
        new RegExp(`^${UPLOAD_POLICY.avatar.folder}/${OWNER}/[0-9a-f-]{36}$`),
      );
      expect(result.folder).toBe(UPLOAD_POLICY.avatar.folder);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'r2_signed_upload_issued',
        }),
      );
    });
  });
});
