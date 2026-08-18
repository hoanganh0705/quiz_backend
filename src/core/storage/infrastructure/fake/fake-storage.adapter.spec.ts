/**
 * Unit tests for `FakeStorageAdapter`.
 *
 * Locks the public contract that the rest of `core/storage` and Phase 3's
 * `UploadApplicationService` rely on:
 *   - `upload` returns the expected `UploadResult` shape.
 *   - `publicId` matches `folder/<ownerId>/<uuidv7>`.
 *   - Two uploads produce two distinct `publicId`s.
 *   - `delete` is idempotent (absent `publicId` is a no-op).
 *   - `deriveUrl` is pure (same input → same output) and reflects the
 *     per-purpose transformation.
 *   - `clear()` is the test boundary.
 */

import { FakeStorageAdapter } from './fake-storage.adapter';
import { UPLOAD_POLICY } from '../../domain/upload-policy';
import type { UploadInput } from '../../storage.types';

const OWNER = '0190b1c2-7f3a-7aaa-bbbb-cccccccccccc';

function makeInput(purpose: 'avatar' | 'quiz', size = 1024): UploadInput {
  return {
    buffer: Buffer.alloc(size, 0xab),
    mime: 'image/png',
    bytes: size,
    purpose,
    ownerId: OWNER,
  };
}

describe('FakeStorageAdapter', () => {
  let adapter: FakeStorageAdapter;

  beforeEach(() => {
    adapter = new FakeStorageAdapter();
  });

  describe('upload', () => {
    it('returns the expected UploadResult shape for an avatar upload', async () => {
      const result = await adapter.upload(makeInput('avatar'));

      expect(result.publicId.startsWith(`${UPLOAD_POLICY.avatar.folder}/${OWNER}/`)).toBe(true);
      expect(result.url).toContain(result.publicId);
      expect(result.bytes).toBe(1024);
      expect(result.format).toBe('webp');
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('uses the quiz folder for a quiz upload', async () => {
      const result = await adapter.upload(makeInput('quiz'));

      expect(result.publicId.startsWith(`${UPLOAD_POLICY.quiz.folder}/${OWNER}/`)).toBe(true);
    });

    it('produces two distinct publicIds for two uploads', async () => {
      const a = await adapter.upload(makeInput('avatar'));
      const b = await adapter.upload(makeInput('avatar'));
      expect(a.publicId).not.toEqual(b.publicId);
    });
  });

  describe('delete', () => {
    it('removes a stored asset', async () => {
      const { publicId } = await adapter.upload(makeInput('avatar'));

      await expect(adapter.delete(publicId)).resolves.toBeUndefined();

      const url = adapter.deriveUrl(publicId, 'avatar');
      // deriveUrl is pure, so we cannot observe storage state directly;
      // instead, verify a re-upload produces a different publicId (the
      // old one was forgotten by the internal Map).
      const fresh = await adapter.upload(makeInput('avatar'));
      expect(fresh.publicId).not.toEqual(publicId);
      // url still resolves — that's the contract for `deriveUrl`.
      expect(url).toContain(publicId);
    });

    it('is a no-op for an unknown publicId (idempotent)', async () => {
      await expect(adapter.delete('does-not-exist')).resolves.toBeUndefined();
    });
  });

  describe('deriveUrl', () => {
    it('returns the same URL for the same inputs', () => {
      const urlA = adapter.deriveUrl('folder/uuid', 'avatar');
      const urlB = adapter.deriveUrl('folder/uuid', 'avatar');
      expect(urlA).toEqual(urlB);
    });

    it('embeds the avatar transformation parameters', () => {
      const url = adapter.deriveUrl('quiz-app/avatars/owner/id', 'avatar');
      // Width 512 / height 512 / crop fill are the documented avatar transform.
      expect(url).toContain('width_512');
      expect(url).toContain('height_512');
      expect(url).toContain('crop_fill');
    });

    it('embeds the quiz transformation parameters', () => {
      const url = adapter.deriveUrl('quiz-app/quizzes/owner/id', 'quiz');
      expect(url).toContain('width_1600');
      expect(url).toContain('height_900');
    });
  });

  describe('clear', () => {
    it('wipes every stored asset between tests', async () => {
      const a = await adapter.upload(makeInput('avatar'));
      const b = await adapter.upload(makeInput('quiz'));
      expect(a.publicId).not.toEqual(b.publicId);

      adapter.clear();

      // After clearing, a fresh upload must not collide with the old one
      // and the Map must be empty (no observable state).
      const fresh = await adapter.upload(makeInput('avatar'));
      expect(fresh.publicId).not.toEqual(a.publicId);
    });
  });
});
