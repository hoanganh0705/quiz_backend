import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v7 as uuidv7 } from 'uuid';

import {
  type SignedUpload,
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
    }
  }

  deriveUrl(publicId: string, purpose: UploadPurpose): string {
    return this.sdk.url(publicId, {
      secure: true,
      transformation: [...UPLOAD_POLICY[purpose].transformation],
    });
  }

  async ping(): Promise<void> {
    try {
      await this.sdk.ping();
    } catch (error) {
      this.logger.warn({
        event: 'storage_ping_failed',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async createSignedUpload(input: {
    readonly ownerId: string;
    readonly purpose: UploadPurpose;
    readonly expiresInSeconds: number;
  }): Promise<SignedUpload> {
    const policy = UPLOAD_POLICY[input.purpose];
    const publicId = `${policy.folder}/${input.ownerId}/${uuidv7()}`;
    const expiresInSeconds = Math.min(Math.max(input.expiresInSeconds, 60), 3600);
    const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;

    try {
      const signed = await this.sdk.signRequest({
        public_id: publicId,
        timestamp,
      });
      const uploadUrl = `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`;
      const expiresAt = new Date(timestamp * 1000).toISOString();

      this.logger.info({
        event: 'signed_upload_issued',
        publicId,
        purpose: input.purpose,
        expiresAt,
      });

      return {
        uploadUrl,
        publicId,
        expiresAt,
        apiKey: signed.apiKey,
        signature: signed.signature,
        timestamp,
        folder: policy.folder,
      };
    } catch (error) {
      this.logger.warn({
        event: 'signed_upload_sign_failed',
        purpose: input.purpose,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new InternalServerErrorException({
        code: 'UPLOAD_SIGN_FAILED',
        message: 'Failed to issue a signed upload URL. Please retry.',
      });
    }
  }
}
