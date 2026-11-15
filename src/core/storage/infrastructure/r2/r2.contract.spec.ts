import { S3Client } from '@aws-sdk/client-s3';
import { R2StorageAdapter } from './r2.adapter';
import type { StoragePort, UploadInput } from '../../storage.types';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OWNER_A = '0190b1c2-7f3a-7aaa-bbbb-aaaaaaaaaaaa';

function makeInput(ownerId: string, purpose: 'avatar' | 'quiz'): UploadInput {
  return {
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    mime: 'image/png',
    bytes: 4,
    purpose,
    ownerId,
  };
}

describe('StoragePort contract (via R2StorageAdapter)', () => {
  let s3SendMock: jest.Mock;
  let mockS3Client: S3Client;
  let adapter: R2StorageAdapter;
  let port: StoragePort;

  beforeEach(() => {
    s3SendMock = jest.fn().mockResolvedValue({});
    mockS3Client = { send: s3SendMock } as unknown as S3Client;
    adapter = new R2StorageAdapter(
      mockS3Client,
      {
        accountId: 'test-acc',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        bucketName: 'quiz-app-assets',
        endpoint: 'https://test-acc.r2.cloudflarestorage.com',
        publicUrl: 'https://images.example.com',
        folder: 'quiz-app',
      },
      {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as never,
    );
    port = adapter;
  });

  describe('upload', () => {
    it('requires ownerId in the publicId shape (structural defence)', async () => {
      const result = await port.upload(makeInput(OWNER_A, 'avatar'));
      const segments = result.publicId.split('/');
      expect(segments).toHaveLength(4);
      expect(segments[0]).toBe('quiz-app');
      expect(segments[1]).toBe('avatars');
      expect(segments[2]).toBe(OWNER_A);
      expect(segments[3]).toMatch(UUID_V7);
    });

    it('appends a UUIDv7 tail to every uploaded publicId', async () => {
      const result = await port.upload(makeInput(OWNER_A, 'avatar'));
      const tail = result.publicId.split('/').pop();
      expect(tail).toMatch(UUID_V7);
    });

    it('uses the quiz folder for purpose=quiz', async () => {
      const result = await port.upload(makeInput(OWNER_A, 'quiz'));
      expect(result.publicId.startsWith('quiz-app/quizzes/')).toBe(true);
    });

    it('returns UploadResult shape (publicId, url, bytes, format, width, height)', async () => {
      const result = await port.upload(makeInput(OWNER_A, 'avatar'));
      expect(result).toMatchObject({
        publicId: expect.any(String),
        url: expect.any(String),
        bytes: expect.any(Number),
        format: expect.any(String),
        width: expect.any(Number),
        height: expect.any(Number),
      });
    });

    it('returned url references the same publicId', async () => {
      const result = await port.upload(makeInput(OWNER_A, 'avatar'));
      expect(result.url).toContain(result.publicId);
    });
  });

  describe('delete', () => {
    it('is idempotent (deleting an absent publicId resolves)', async () => {
      await expect(port.delete('quiz-app/avatars/x/y')).resolves.toBeUndefined();
      await expect(port.delete('quiz-app/avatars/x/y')).resolves.toBeUndefined();
    });
  });

  describe('deriveUrl', () => {
    it('is pure — same input always produces same output', () => {
      expect(port.deriveUrl('p', 'avatar')).toBe(port.deriveUrl('p', 'avatar'));
    });

    it('contains the publicId (so the URL is renderable)', () => {
      const url = port.deriveUrl('quiz-app/avatars/x/y', 'avatar');
      expect(url).toContain('quiz-app/avatars/x/y');
    });
  });
});
