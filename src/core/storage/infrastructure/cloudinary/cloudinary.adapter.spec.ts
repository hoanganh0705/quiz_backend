/**
 * Unit tests for `CloudinaryStorageAdapter`.
 *
 * The adapter is the only piece of `core/storage` that talks to a
 * concrete third-party SDK. These tests inject a hand-rolled mock of
 * the narrow `CloudinarySDK` interface so we never need a network
 * round-trip in unit tests.
 */

import { Transform, type TransformCallback } from 'node:stream';

import { CloudinaryStorageAdapter } from './cloudinary.adapter';
import {
  type CloudinarySDK,
  type DestroyResult,
  type UploadStreamCallback,
  type UploadStreamResult,
} from './cloudinary.config';
import { UPLOAD_POLICY } from '../../domain/upload-policy';
import type { UploadInput } from '../../storage.types';

const OWNER = '0190b1c2-7f3a-7aaa-bbbb-cccccccccccc';

/**
 * Build a fake `Transform` that calls `cb` once the consumer `.end()`s
 * it. Mirrors how Cloudinary's `UploadStream` behaves: write buffers,
 * end the stream, then the callback fires with the parsed response.
 */
function makeUploadStreamTransform(result: UploadStreamResult): Transform {
  let capturedCb: UploadStreamCallback | null = null;
  const t = new Transform({
    transform(_chunk, _enc, next: TransformCallback) {
      next();
    },
  });
  // The adapter writes + ends. The mock resolves the callback on end so
  // the adapter sees a successful upload.
  const originalEnd = t.end.bind(t);
  t.end = ((...args: unknown[]) => {
    const r = originalEnd(...args);
    queueMicrotask(() => {
      if (capturedCb) capturedCb(null, result);
    });
    return r;
  }) as typeof t.end;
  // Capture the callback passed to upload_stream via a wrapper installed
  // by the test setup (see `upload_stream` mock below).
  (t as Transform & { __capturedCb?: UploadStreamCallback }).__capturedCb = null;
  Object.defineProperty(t, '__capturedCb', {
    get() {
      return capturedCb;
    },
    set(v: UploadStreamCallback | null) {
      capturedCb = v;
    },
  });
  return t;
}

function makeSdk(overrides: Partial<CloudinarySDK> = {}): CloudinarySDK & {
  _uploadStream: jest.Mock;
  _destroy: jest.Mock;
  _url: jest.Mock;
} {
  const uploadStreamMock = jest.fn((opts: Record<string, unknown>, cb: UploadStreamCallback) => {
    const publicIdValue = opts['public_id'];
    const publicId = typeof publicIdValue === 'string' ? publicIdValue : 'cloud/owner/uuid';
    const result: UploadStreamResult = {
      public_id: publicId,
      secure_url: `https://res.cloudinary.com/demo/image/upload/${publicId}`,
      bytes: 2048,
      format: 'png',
      width: 800,
      height: 600,
    };
    const stream = makeUploadStreamTransform(result);
    queueMicrotask(() => {
      (stream as Transform & { __capturedCb?: UploadStreamCallback }).__capturedCb = cb;
    });
    return stream;
  });
  const destroyMock = jest.fn(
    (_publicId: string): Promise<DestroyResult> => Promise.resolve({ result: 'ok' }),
  );
  const urlMock = jest.fn((publicId: string, _opts: Record<string, unknown>): string => {
    return `https://res.cloudinary.com/demo/image/upload/${publicId}`;
  });

  return {
    upload_stream: overrides.upload_stream ?? uploadStreamMock,
    destroy: overrides.destroy ?? destroyMock,
    url: overrides.url ?? urlMock,
    _uploadStream: uploadStreamMock,
    _destroy: destroyMock,
    _url: urlMock,
  };
}

function makeLogger() {
  return {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as never;
}

function makeInput(purpose: 'avatar' | 'quiz'): UploadInput {
  return {
    buffer: Buffer.from('hello'),
    mime: 'image/png',
    bytes: 5,
    purpose,
    ownerId: OWNER,
  };
}

describe('CloudinaryStorageAdapter', () => {
  describe('upload', () => {
    it('composes publicId as folder/ownerId/uuidv7 and maps the response', async () => {
      const sdk = makeSdk();
      const adapter = new CloudinaryStorageAdapter(sdk, makeLogger());

      const result = await adapter.upload(makeInput('avatar'));

      expect(sdk._uploadStream).toHaveBeenCalledTimes(1);
      const [opts] = sdk._uploadStream.mock.calls[0]!;
      expect(opts['public_id']).toMatch(
        new RegExp(`^${UPLOAD_POLICY.avatar.folder}/${OWNER}/[0-9a-f-]{36}$`),
      );
      expect(opts['resource_type']).toBe('image');
      expect(opts['overwrite']).toBe(false);
      expect(result.publicId).toBe(opts['public_id']);
      expect(result.url).toContain(result.publicId);
      expect(result.bytes).toBe(2048);
      expect(result.format).toBe('png');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('uses the quiz folder for quiz uploads', async () => {
      const sdk = makeSdk();
      const adapter = new CloudinaryStorageAdapter(sdk, makeLogger());

      await adapter.upload(makeInput('quiz'));

      const [opts] = sdk._uploadStream.mock.calls[0]!;
      expect(opts['public_id']).toMatch(
        new RegExp(`^${UPLOAD_POLICY.quiz.folder}/${OWNER}/[0-9a-f-]{36}$`),
      );
    });

    it('throws UPLOAD_PROVIDER_UNAVAILABLE when the SDK errors', async () => {
      const sdk = makeSdk({
        upload_stream: jest.fn((_opts, cb) => {
          const stream = new Transform({
            transform(_c, _e, next) {
              next();
            },
          });
          queueMicrotask(() => cb(new Error('network down'), undefined));
          return stream;
        }),
      });
      const adapter = new CloudinaryStorageAdapter(sdk, makeLogger());

      await expect(adapter.upload(makeInput('avatar'))).rejects.toMatchObject({
        response: { code: 'UPLOAD_PROVIDER_UNAVAILABLE' },
      });
    });
  });

  describe('delete', () => {
    it('treats result=not found as a success (idempotent)', async () => {
      const destroyMock = jest.fn(() => Promise.resolve({ result: 'not found' }));
      const sdk = makeSdk({ destroy: destroyMock as CloudinarySDK['destroy'] });
      const adapter = new CloudinaryStorageAdapter(sdk, makeLogger());

      await expect(adapter.delete('quiz-app/avatars/owner/old')).resolves.toBeUndefined();
      expect(destroyMock).toHaveBeenCalledWith('quiz-app/avatars/owner/old');
    });

    it('swallows SDK errors (lifecycle deletes are best-effort)', async () => {
      const destroyMock = jest.fn((): Promise<DestroyResult> => {
        return Promise.reject(new Error('cloudinary 503'));
      });
      const sdk = makeSdk({ destroy: destroyMock as CloudinarySDK['destroy'] });
      const adapter = new CloudinaryStorageAdapter(sdk, makeLogger());

      await expect(adapter.delete('quiz-app/avatars/owner/x')).resolves.toBeUndefined();
    });
  });

  describe('deriveUrl', () => {
    it('delegates to sdk.url with the per-purpose transformation', () => {
      const sdk = makeSdk();
      const adapter = new CloudinaryStorageAdapter(sdk, makeLogger());

      const url = adapter.deriveUrl('quiz-app/avatars/owner/id', 'avatar');

      expect(sdk._url).toHaveBeenCalledWith(
        'quiz-app/avatars/owner/id',
        expect.objectContaining({ secure: true, transformation: expect.any(Array) }),
      );
      expect(url).toContain('quiz-app/avatars/owner/id');
    });
  });
});
