import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v7 as uuidv7 } from 'uuid';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { r2Config, type R2Config } from '@/core/config';
import {
  type SignedUpload,
  type StoragePort,
  type UploadInput,
  type UploadPurpose,
  type UploadResult,
} from '../../storage.types';
import { UPLOAD_POLICY } from '../../domain/upload-policy';
import { R2_S3_CLIENT } from './r2.client';

@Injectable()
export class R2StorageAdapter implements StoragePort {
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly endpoint: string;

  constructor(
    @Inject(R2_S3_CLIENT) private readonly s3Client: S3Client,
    @Inject(r2Config.KEY) private readonly config: R2Config,
    @InjectPinoLogger(R2StorageAdapter.name) private readonly logger: PinoLogger,
  ) {
    this.bucketName = this.config.bucketName;
    this.publicUrl = this.config.publicUrl;
    this.endpoint = this.config.endpoint;
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const policy = UPLOAD_POLICY[input.purpose];
    const publicId = `${policy.folder}/${input.ownerId}/${uuidv7()}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: publicId,
        Body: input.buffer,
        ContentType: input.mime,
        ContentLength: input.bytes,
        CacheControl: 'public, max-age=31536000, immutable',
      });

      await this.s3Client.send(command);

      const format = input.mime.split('/')[1] ?? 'jpeg';
      const width = input.purpose === 'avatar' ? 512 : 1600;
      const height = input.purpose === 'avatar' ? 512 : 900;

      return {
        publicId,
        url: this.deriveUrl(publicId, input.purpose),
        bytes: input.bytes,
        format,
        width,
        height,
      };
    } catch (err) {
      this.logger.warn({
        event: 'r2_upload_failed',
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
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: publicId,
      });
      await this.s3Client.send(command);
    } catch (err) {
      this.logger.warn({
        event: 'r2_destroy_failed',
        publicId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  deriveUrl(publicId: string, _purpose: UploadPurpose): string {
    if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
      return publicId;
    }
    if (this.publicUrl) {
      return `${this.publicUrl}/${publicId}`;
    }
    const endpoint = this.endpoint
      ? this.endpoint.replace(/\/+$/, '')
      : `https://${this.bucketName}.r2.cloudflarestorage.com`;
    return `${endpoint}/${this.bucketName}/${publicId}`;
  }

  async ping(): Promise<void> {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.bucketName,
        }),
      );
    } catch (error) {
      this.logger.warn({
        event: 'r2_storage_ping_failed',
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
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: publicId,
      });
      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });
      const expiresAt = new Date(timestamp * 1000).toISOString();

      this.logger.info({
        event: 'r2_signed_upload_issued',
        publicId,
        purpose: input.purpose,
        expiresAt,
      });

      return {
        uploadUrl,
        publicId,
        expiresAt,
        apiKey: '',
        signature: '',
        timestamp,
        folder: policy.folder,
      };
    } catch (error) {
      this.logger.warn({
        event: 'r2_signed_upload_sign_failed',
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
