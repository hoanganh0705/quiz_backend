import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  type SignedUpload,
  type StoragePort,
  type UploadInput,
  type UploadPurpose,
  type UploadResult,
} from '../../storage.types';
import { UPLOAD_POLICY } from '../../domain/upload-policy';

interface StoredAsset {
  readonly buffer: Buffer;
  readonly mime: string;
  readonly bytes: number;
  readonly ownerId: string;
  readonly purpose: UploadPurpose;
  readonly createdAt: Date;
}

@Injectable()
export class FakeStorageAdapter implements StoragePort {
  private readonly assets = new Map<string, StoredAsset>();

  upload(input: UploadInput): Promise<UploadResult> {
    const policy = UPLOAD_POLICY[input.purpose];
    const publicId = `${policy.folder}/${input.ownerId}/${uuidv7()}`;
    const stored: StoredAsset = {
      buffer: input.buffer,
      mime: input.mime,
      bytes: input.bytes,
      ownerId: input.ownerId,
      purpose: input.purpose,
      createdAt: new Date(),
    };
    this.assets.set(publicId, stored);

    const result: UploadResult = {
      publicId,
      url: this.deriveUrl(publicId, input.purpose),
      bytes: stored.bytes,
      format: 'webp',
      width: 1_024,
      height: 1_024,
    };
    return Promise.resolve(result);
  }

  delete(publicId: string): Promise<void> {
    this.assets.delete(publicId);
    return Promise.resolve();
  }

  deriveUrl(publicId: string, purpose: UploadPurpose): string {
    const policy = UPLOAD_POLICY[purpose];
    const params = policy.transformation[0] ?? {};
    const query = Object.entries(params)
      .map(([k, v]) => `${k}_${String(v).replace(/_/g, ':')}`)
      .join(',');
    return `https://fake.cloudinary.local/${query ? `${query}/` : ''}image/upload/${publicId}`;
  }

  clear(): void {
    this.assets.clear();
  }

  async ping(): Promise<void> {
    return Promise.resolve();
  }

  createSignedUpload(input: {
    readonly ownerId: string;
    readonly purpose: UploadPurpose;
    readonly expiresInSeconds: number;
  }): Promise<SignedUpload> {
    const policy = UPLOAD_POLICY[input.purpose];
    const publicId = `${policy.folder}/${input.ownerId}/${uuidv7()}`;
    const expiresInSeconds = Math.min(Math.max(input.expiresInSeconds, 60), 3600);
    const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const expiresAt = new Date(timestamp * 1000).toISOString();

    return Promise.resolve({
      uploadUrl: `https://fake.cloudinary.local/image/upload`,
      publicId,
      expiresAt,
      apiKey: 'fake-key',
      signature: 'fake-signature',
      timestamp,
      folder: policy.folder,
    });
  }
}
