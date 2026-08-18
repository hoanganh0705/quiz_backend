/**
 * In-memory `StoragePort` for tests and local development without a
 * real Cloudinary account.
 *
 * `upload` composes a `publicId` matching the real adapter's contract
 * (`${folder}/${ownerId}/${uuidv7()}`) and stores the buffer in a Map.
 * `deriveUrl` returns a deterministic fake URL so render paths can be
 * exercised in tests.
 *
 * This adapter is NOT registered globally by default — the test module
 * imports `StorageModule.forRoot({ adapter: 'fake' })` explicitly.
 */

import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
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

  /**
   * Test helper. Wipes all stored assets between cases so tests do not
   * bleed into each other. Not part of the `StoragePort` contract.
   */
  clear(): void {
    this.assets.clear();
  }
}
