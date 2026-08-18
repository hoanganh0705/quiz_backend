/**
 * `UploadApplicationService` — the upload flow's orchestrator.
 *
 * The §11 invariant: every uploaded `publicId` MUST be bound to its
 * owner in `storage_assets` before the API returns success. This
 * service performs both halves and is the ONLY place that writes the
 * binding on the upload side.
 *
 *   1. Read the per-purpose policy from `UPLOAD_POLICY` and re-check
 *      the file's MIME and byte count (after `ParseFilePipe` already
 *      did its pass). Defence in depth — the application service is
 *      the last trusted layer.
 *   2. Call `STORAGE_PORT.upload(...)`. On 4xx (unsupported media type)
 *      or 5xx (provider unavailable) we map to typed HTTP exceptions
 *      and surface the documented error codes.
 *   3. On success, call `StorageApplicationService.bindAssetToOwner(...)`
 *      so the durable ownership row exists.
 *   4. If the bind throws, best-effort delete the Cloudinary asset
 *      (so we do not orphan a publicId with no DB row). Then throw
 *      `UPLOAD_OWNERSHIP_BIND_FAILED` — the controller maps this to
 *      a 500 with the documented error code.
 *
 * Why the bind happens *after* the upload rather than inside the
 * adapter: the adapter must remain storage-only (no DB dependency).
 * Splitting the orchestration keeps the hexagonal boundary clean and
 * makes both halves independently testable.
 */

import {
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  STORAGE_PORT,
  UPLOAD_POLICY,
  StorageApplicationService,
  StorageOwnershipBindFailedError,
  type StoragePort,
  type UploadPurpose,
  type UploadResult,
} from '@/core/storage';

import type { UploadPurposeLiteral } from '../dto/request/upload-file.request.dto';

const UPLOAD_PURPOSE_MAP: Record<UploadPurposeLiteral, UploadPurpose> = {
  avatar: 'avatar',
  quiz: 'quiz',
};

@Injectable()
export class UploadApplicationService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly ownership: StorageApplicationService,
    @InjectPinoLogger(UploadApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Upload one image, bind ownership to `ownerId` (= `currentUser.sub`).
   *
   * `file` is the Multer `Express.Multer.File` (memory storage).
   * `purpose` is the validated wire literal.
   *
   * Throws:
   *   - `UnsupportedMediaTypeException` (400) — declared MIME is not in
   *     `UPLOAD_POLICY[purpose].allowedMime`. Echoed by the controller
   *     as `UPLOAD_UNSUPPORTED_MEDIA_TYPE`.
   *   - `PayloadTooLargeException` (400) — byte count exceeds
   *     `UPLOAD_POLICY[purpose].maxBytes`. Echoed as
   *     `UPLOAD_FILE_TOO_LARGE`.
   *   - `BadRequestException` (400) — empty/missing file. Echoed as
   *     `UPLOAD_NO_FILE`.
   *   - `ServiceUnavailableException` (502) — Cloudinary 5xx. Echoed
   *     as `UPLOAD_PROVIDER_UNAVAILABLE`.
   *   - `StorageOwnershipBindFailedError` (500) — bind step failed.
   *     Echoed as `UPLOAD_OWNERSHIP_BIND_FAILED`.
   */
  async uploadAvatarOrQuizCover(input: {
    ownerId: string;
    purpose: UploadPurposeLiteral;
    file: Express.Multer.File | undefined;
  }): Promise<UploadResult> {
    if (!input.file) {
      throw new BadRequestException({
        code: 'UPLOAD_NO_FILE',
        message: 'Multipart field "file" is required.',
      });
    }

    const purpose = UPLOAD_PURPOSE_MAP[input.purpose];
    const policy = UPLOAD_POLICY[purpose];

    if (!policy.allowedMime.has(input.file.mimetype)) {
      throw new UnsupportedMediaTypeException({
        code: 'UPLOAD_UNSUPPORTED_MEDIA_TYPE',
        message: `Declared MIME "${input.file.mimetype}" is not allowed for purpose "${purpose}".`,
        allowed: Array.from(policy.allowedMime),
      });
    }

    if (input.file.size > policy.maxBytes) {
      throw new PayloadTooLargeException({
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: `File exceeds ${policy.maxBytes} bytes for purpose "${purpose}".`,
        maxBytes: policy.maxBytes,
        actualBytes: input.file.size,
      });
    }

    let uploadResult: UploadResult;
    try {
      uploadResult = await this.storage.upload({
        buffer: input.file.buffer,
        mime: input.file.mimetype,
        bytes: input.file.size,
        purpose,
        ownerId: input.ownerId,
      });
    } catch (err) {
      // The adapter is the place that retries 5xx. A throw here means
      // the retry policy was exhausted, or the SDK surfaced a
      // non-retryable client error (e.g. magic-byte mismatch).
      this.logger.warn(
        {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          err,
          purpose,
          ownerId: input.ownerId,
          mime: input.file.mimetype,
        },
        'Cloudinary upload failed; mapping to UPLOAD_PROVIDER_UNAVAILABLE',
      );
      throw new ServiceUnavailableException({
        code: 'UPLOAD_PROVIDER_UNAVAILABLE',
        message: 'Storage provider rejected the upload. Please retry shortly.',
      });
    }

    try {
      await this.ownership.bindAssetToOwner({
        publicId: uploadResult.publicId,
        ownerId: input.ownerId,
        purpose,
      });
    } catch (err) {
      // Bind failed (most commonly: UNIQUE collision on public_id — a
      // race or a forged id). Best-effort delete so the Cloudinary
      // asset is not orphaned. If the delete itself fails, we log and
      // re-raise the bind failure; an admin sweep can reconcile later.
      this.logger.error(
        {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          err,
          publicId: uploadResult.publicId,
          ownerId: input.ownerId,
          purpose,
        },
        'Ownership bind failed after upload; best-effort deleting Cloudinary asset',
      );
      try {
        await this.storage.delete(uploadResult.publicId);
      } catch (cleanupErr) {
        this.logger.error(
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            err: cleanupErr,
            publicId: uploadResult.publicId,
          },
          'Best-effort cleanup of Cloudinary asset also failed; an orphan remains',
        );
      }
      if (err instanceof StorageOwnershipBindFailedError) {
        throw err;
      }
      throw new StorageOwnershipBindFailedError('Failed to bind uploaded asset to owner', {
        cause: err,
      });
    }

    return uploadResult;
  }
}
