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
  /**
   * Insert the binding. Throws on UNIQUE violation (`public_id` already
   * exists — a duplicate or a forged id). Idempotency at this layer is
   * not desired; collisions must be surfaced.
   */
  insert(input: { publicId: string; ownerId: string; purpose: UploadPurpose }): Promise<void>;

  /**
   * The §11 lookup. Returns true only when the (publicId, ownerId,
   * purpose) triple matches an existing row.
   *
   * - Missing row → false (no oracle; same response as wrong owner /
   *   wrong purpose — see §11 "Why this is the right shape").
   * - Wrong owner → false.
   * - Wrong purpose → false (cross-purpose reuse is rejected).
   */
  existsByPublicIdOwnerAndPurpose(input: {
    publicId: string;
    ownerId: string;
    purpose: UploadPurpose;
  }): Promise<boolean>;

  /**
   * Delete by `public_id`. Idempotent — a missing row is not an error.
   * Used by `unbindAsset` after a Cloudinary delete succeeds (or fails
   * with `not found`) to keep the DB consistent.
   */
  deleteByPublicId(publicId: string): Promise<void>;
}
