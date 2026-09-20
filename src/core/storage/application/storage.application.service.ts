import { Inject, Injectable } from '@nestjs/common';

import {
  STORAGE_ASSETS_REPOSITORY,
  type StorageAssetsRepositoryPort,
} from '../domain/ports/storage-assets-repository.port';
import type { UploadPurpose } from '../storage.types';

export class StorageOwnershipBindFailedError extends Error {
  readonly cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'StorageOwnershipBindFailedError';
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

@Injectable()
export class StorageApplicationService {
  constructor(
    @Inject(STORAGE_ASSETS_REPOSITORY)
    private readonly storageAssets: StorageAssetsRepositoryPort,
  ) {}

  async bindAssetToOwner(input: {
    publicId: string;
    ownerId: string;
    purpose: UploadPurpose;
  }): Promise<void> {
    try {
      await this.storageAssets.insert(input);
    } catch (err) {
      throw new StorageOwnershipBindFailedError('Failed to bind uploaded asset to owner', {
        cause: err,
      });
    }
  }

  async userOwnsAssetForPurpose(input: {
    publicId: string;
    ownerId: string;
    purpose: UploadPurpose;
  }): Promise<boolean> {
    return this.storageAssets.existsByPublicIdOwnerAndPurpose(input);
  }

  async unbindAsset(publicId: string): Promise<void> {
    await this.storageAssets.deleteByPublicId(publicId);
  }

  async assetExists(publicId: string): Promise<boolean> {
    const rows = await this.storageAssets.findByPublicId(publicId);
    return rows.length > 0;
  }
}
