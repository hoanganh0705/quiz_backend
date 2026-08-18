/**
 * Contract test for the `StoragePort` interface.
 *
 * The hexagonal architecture's whole point is that domain modules
 * depend on `StoragePort`, not on Cloudinary. These tests exercise
 * the in-memory `FakeStorageAdapter` against the contract to lock the
 * shape that ANY adapter must satisfy.
 *
 * Concrete adapters (Cloudinary) must pass the same matrix via
 * `cloudinary.adapter.spec.ts`; this file documents the canonical
 * behaviour that any new adapter must reproduce.
 */
import { FakeStorageAdapter } from '../infrastructure/fake/fake-storage.adapter';
import type { StoragePort, UploadInput } from '../storage.types';
import { UPLOAD_POLICY } from './upload-policy';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const OWNER_A = '0190b1c2-7f3a-7aaa-bbbb-aaaaaaaaaaaa';
const OWNER_B = '0190b1c2-7f3a-7aaa-bbbb-bbbbbbbbbbbb';

function makeInput(ownerId: string, purpose: 'avatar' | 'quiz'): UploadInput {
  return {
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    mime: 'image/png',
    bytes: 4,
    purpose,
    ownerId,
  };
}

describe('StoragePort contract (via FakeStorageAdapter)', () => {
  let adapter: FakeStorageAdapter;
  let port: StoragePort;

  beforeEach(() => {
    adapter = new FakeStorageAdapter();
    port = adapter;
    adapter.clear();
  });

  describe('upload', () => {
    it('requires ownerId in the publicId shape (structural defence)', async () => {
      const result = await port.upload(makeInput(OWNER_A, 'avatar'));
      // publicId is `${folder}/${ownerId}/${uuidv7}` where folder is
      // "quiz-app/avatars" — i.e. four `/`-separated segments.
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

    it('removes the publicId so subsequent deletes remain no-ops', async () => {
      const result = await port.upload(makeInput(OWNER_A, 'avatar'));
      await port.delete(result.publicId);
      await expect(port.delete(result.publicId)).resolves.toBeUndefined();
    });
  });

  describe('deriveUrl', () => {
    it('is pure — same input always produces same output', () => {
      expect(port.deriveUrl('p', 'avatar')).toBe(port.deriveUrl('p', 'avatar'));
    });

    it('returns different URLs for different purposes', () => {
      const a = port.deriveUrl('p', 'avatar');
      const q = port.deriveUrl('p', 'quiz');
      expect(a).not.toBe(q);
    });

    it('contains the publicId (so the URL is renderable)', () => {
      const url = port.deriveUrl('quiz-app/avatars/x/y', 'avatar');
      expect(url).toContain('quiz-app/avatars/x/y');
    });
  });
});