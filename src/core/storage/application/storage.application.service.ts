/**
 * The §11 ownership rule, exposed as an injectable service.
 *
 *   "A publicId may only be associated with an entity if the
 *    authenticated user is the owner recorded in storage_assets for
 *    that publicId and the recorded purpose matches the target entity."
 *
 * Three operations:
 *
 *   bindAssetToOwner       — called once, server-side, immediately
 *                            after `STORAGE_PORT.upload` succeeds.
 *                            The upload application service is the
 *                            *only* caller; on bind failure it
 *                            best-effort deletes the Cloudinary asset
 *                            and surfaces UPLOAD_OWNERSHIP_BIND_FAILED.
 *
 *   userOwnsAssetForPurpose — the §11 gate. Called by user/quiz
 *                            application services *before* writing
 *                            `avatar_public_id` / `image_public_id`.
 *                            `false` → caller returns 403
 *                            ASSET_NOT_OWNED (or 400 if the input
 *                            shape is wrong — caught by the DTO
 *                            validator).
 *
 *   unbindAsset             — called by the lifecycle service after
 *                            a Cloudinary delete. Idempotent.
 *
 * The actual row lookup lives in `StorageAssetsRepository`. This
 * service is a thin orchestrator + a single, easy-to-mock seam for
 * tests (and the future admin "purge orphans" endpoint).
 */

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

  /**
   * Insert the (publicId, ownerId, purpose) binding. Throws on collision
   * — the upload application service catches and best-effort deletes
   * the Cloudinary asset before returning UPLOAD_OWNERSHIP_BIND_FAILED.
   */
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

  /**
   * The §11 gate. `true` only when (publicId, ownerId, purpose) matches
   * an existing row in `storage_assets`. Missing row, wrong owner, and
   * wrong purpose all return `false` — same response, no oracle.
   */
  async userOwnsAssetForPurpose(input: {
    publicId: string;
    ownerId: string;
    purpose: UploadPurpose;
  }): Promise<boolean> {
    return this.storageAssets.existsByPublicIdOwnerAndPurpose(input);
  }

  /**
   * Idempotent. A missing row is not an error — the asset may have been
   * deleted earlier, or it may have never existed (a forged id).
   */
  async unbindAsset(publicId: string): Promise<void> {
    await this.storageAssets.deleteByPublicId(publicId);
  }
}
