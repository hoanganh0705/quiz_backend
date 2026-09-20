/**
 * Repository port for the `storage_assets` table.
 *
 * The single durable record of "who owns this Cloudinary asset". Used by
 * `StorageApplicationService` to answer the §11 ownership rule:
 *
 *   "A publicId may only be associated with an entity if the
 *    authenticated user is the owner recorded in storage_assets for
 *    that publicId and the recorded purpose matches the target entity."
 *
 * Implementation: `core/storage/infrastructure/repositories/storage-assets.repository.ts`.
 */

import type { UploadPurpose } from '../../storage.types';

export const STORAGE_ASSETS_REPOSITORY = Symbol('STORAGE_ASSETS_REPOSITORY');

export interface StorageAssetsRepositoryPort {
  insert(input: { publicId: string; ownerId: string; purpose: UploadPurpose }): Promise<void>;

  existsByPublicIdOwnerAndPurpose(input: {
    publicId: string;
    ownerId: string;
    purpose: UploadPurpose;
  }): Promise<boolean>;

  deleteByPublicId(publicId: string): Promise<void>;

  findByPublicId(
    publicId: string,
  ): Promise<Array<{ publicId: string; ownerId: string; purpose: UploadPurpose }>>;
}
