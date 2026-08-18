/**
 * `StoragePort` implementation backed by Cloudinary.
 *
 * The adapter:
 *   - composes `public_id = folder/<ownerId>/<uuidv7()>` from
 *     `UPLOAD_POLICY[input.purpose].folder` and the caller-supplied
 *     `ownerId`. `ownerId` is sourced from the application service
 *     (authenticated user), never from the request body.
 *   - uploads via `sdk.upload_stream` so the bytes never touch disk
 *     (Multer `memoryStorage`).
 *   - maps Cloudinary's response into our `UploadResult`.
 *   - treats `destroy(...).result === 'not found'` as a successful
 *     delete (idempotent lifecycle — see migration plan §10).
 *
 * The SDK is injected through the narrow `CloudinarySDK` interface, so
 * this adapter is unit-testable without ever importing `cloudinary`.
 */

import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v7 as uuidv7 } from 'uuid';

import {
  type StoragePort,
  type UploadInput,
  type UploadPurpose,
  type UploadResult,
} from '../../storage.types';
import { UPLOAD_POLICY } from '../../domain/upload-policy';
import { type CloudinarySDK, type UploadStreamResult, CLOUDINARY_SDK } from './cloudinary.config';

@Injectable()
export class CloudinaryStorageAdapter implements StoragePort {
  constructor(
    @Inject(CLOUDINARY_SDK) private readonly sdk: CloudinarySDK,
    @InjectPinoLogger(CloudinaryStorageAdapter.name) private readonly logger: PinoLogger,
  ) {}

  async upload(input: UploadInput): Promise<UploadResult> {
    const policy = UPLOAD_POLICY[input.purpose];
    const publicId = `${policy.folder}/${input.ownerId}/${uuidv7()}`;

    try {
      const result = await new Promise<UploadStreamResult>((resolve, reject) => {
        const stream = this.sdk.upload_stream(
          {
            public_id: publicId,
            resource_type: 'image',
            overwrite: false,
          },
          (err, res) => {
            if (err) {
              reject(err);
              return;
            }
            if (!res) {
              reject(new Error('Cloudinary upload_stream returned no result'));
              return;
            }
            resolve(res);
          },
        );
        stream.on('error', (err: Error) => reject(err));
        stream.write(input.buffer);
        stream.end();
      });

      return {
        publicId: result.public_id,
        url: result.secure_url,
        bytes: result.bytes,
        format: result.format,
        width: result.width,
        height: result.height,
      };
    } catch (err) {
      this.logger.warn({
        event: 'cloudinary_upload_failed',
        publicId,
        purpose: input.purpose,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new InternalServerErrorException({
        code: 'UPLOAD_PROVIDER_UNAVAILABLE',
        message: 'Image upload to the storage provider failed. Please retry.',
      });
    }
  }

  async delete(publicId: string): Promise<void> {
    try {
      const result = await this.sdk.destroy(publicId);
      if (result.result === 'not found') {
        // Already gone — idempotent success.
        return;
      }
      if (result.result !== 'ok') {
        this.logger.warn({
          event: 'cloudinary_destroy_unexpected_result',
          publicId,
          result: result.result,
        });
      }
    } catch (err) {
      this.logger.warn({
        event: 'cloudinary_destroy_failed',
        publicId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Swallow per migration plan §10: lifecycle deletes are
      // best-effort. The orphan row in `storage_assets` (Phase 4) does
      // not affect correctness, only storage accounting.
    }
  }

  deriveUrl(publicId: string, purpose: UploadPurpose): string {
    return this.sdk.url(publicId, {
      secure: true,
      transformation: [...UPLOAD_POLICY[purpose].transformation],
    });
  }
}
