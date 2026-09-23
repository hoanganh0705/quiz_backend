import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
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
  type SignedUpload,
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

  async signUpload(input: {
    ownerId: string;
    purpose: UploadPurposeLiteral;
    expiresInSeconds?: number;
  }): Promise<SignedUpload> {
    const purpose = UPLOAD_PURPOSE_MAP[input.purpose];
    return this.storage.createSignedUpload({
      ownerId: input.ownerId,
      purpose,
      expiresInSeconds: input.expiresInSeconds ?? 600,
    });
  }

  async bindAsset(input: {
    ownerId: string;
    publicId: string;
    purpose: UploadPurposeLiteral;
  }): Promise<void> {
    const exists = await this.ownership.assetExists(input.publicId);
    if (!exists) {
      throw new NotFoundException({
        code: 'UPLOAD_ASSET_NOT_FOUND',
        message: `No uploaded asset matches publicId "${input.publicId}". Complete the upload first or supply a publicId returned by the storage provider.`,
      });
    }

    const purpose = UPLOAD_PURPOSE_MAP[input.purpose];
    await this.ownership.bindAssetToOwner({
      publicId: input.publicId,
      ownerId: input.ownerId,
      purpose,
    });
  }
}
