/**
 * Phase 6 — image lifecycle / cleanup service.
 *
 * When a user replaces their avatar / quiz cover (or removes it), the
 * underlying Cloudinary asset is no longer referenced from the owning
 * entity. To keep the storage provider's account clean — and to make
 * sure the same `publicId` is never reused for two different entities
 * — we:
 *
 *   1. read the *old* `publicId` (or skip the step if there is none),
 *   2. delete the asset from Cloudinary (`STORAGE_PORT.delete`),
 *   3. unbind it from `storage_assets` via `StorageApplicationService.unbindAsset`.
 *
 * This service is called *after* the entity's `*_public_id` column has
 * been updated. Failures during delete are best-effort: they log at
 * WARN level and the call continues. The DB row in `storage_assets`
 * is removed regardless of whether Cloudinary delete succeeded —
 * leaving the binding around would block future uploads with the same
 * `publicId` (UNIQUE constraint).
 *
 * Five operations, mirroring the entity lifecycle:
 *
 *   replaceAvatar(userId, newPublicId)      — used by updateProfile
 *   removeAvatar(userId)                    — alias of replaceAvatar(_, null)
 *   replaceQuizCover(quizId, newPublicId)   — used by updateQuiz
 *   removeQuizCover(quizId)                 — alias of replaceQuizCover(_, null)
 *   deleteQuizCover(quizId)                 — used by deleteQuiz (soft delete)
 *
 * The "current value" lookup is injected as a `() => Promise<string | null>`
 * so the lifecycle service does not own the user / quiz repositories
 * (which are themselves module-private to user / quiz). This also
 * keeps the lifecycle service trivially unit-testable: the only
 * non-trivial dependencies are `STORAGE_PORT` and `StorageApplicationService`.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { STORAGE_PORT, type StoragePort } from '../storage.port';
import { StorageApplicationService } from './storage.application.service';

export interface ReadAvatarPublicIdFn {
  (userId: string): Promise<string | null>;
}

export interface ReadQuizCoverPublicIdFn {
  (quizId: string): Promise<string | null>;
}

@Injectable()
export class StorageImageLifecycleService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly storageApplication: StorageApplicationService,
    @InjectPinoLogger(StorageImageLifecycleService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Backing implementation for all "replace *PublicId" operations.
   * `newPublicId === null` means "clear the column" (e.g. user removes
   * their avatar). `currentPublicId === null` is a no-op (no asset to
   * clean up). Same identity (`current === new`) is also a no-op —
   * the PATCH body did not change the column.
   *
   * The Cloudinary delete is best-effort and retried once on
   * transient failure. The `storage_assets` unbind happens
   * unconditionally *after* the delete attempt: a delete failure
   * leaves an orphan Cloudinary asset that a future sweep can purge,
   * but a stale binding would block future uploads with the same
   * `publicId` (UNIQUE) and is therefore always removed.
   */
  private async replace(currentPublicId: string | null, newPublicId: string | null): Promise<void> {
    if (currentPublicId === null || currentPublicId === newPublicId) {
      // No asset to remove (or it is unchanged — caller PATCHed the
      // same publicId back). Nothing to do.
      return;
    }

    await this.tryDeleteWithRetry(currentPublicId, 2);
    // Unbind is unconditional — see docstring. Unbind failures are
    // also swallowed: a future upload with this `publicId` would
    // collide on the UNIQUE index, which is the correct behaviour.
    try {
      await this.storageApplication.unbindAsset(currentPublicId);
    } catch {
      // already best-effort — log nothing extra, the application
      // service logs the cause at WARN.
    }
  }

  private async tryDeleteWithRetry(publicId: string, maxAttempts: number): Promise<boolean> {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.storage.delete(publicId);
        return true;
      } catch (err) {
        lastErr = err;
        if (attempt >= maxAttempts) break;
      }
    }
    this.logger.warn({
      event: 'storage_lifecycle_cleanup_failed',
      publicId,
      attempts: maxAttempts,

      err: lastErr,
    });
    return false;
  }

  async replaceAvatar(
    userId: string,
    newPublicId: string | null,
    readCurrent: ReadAvatarPublicIdFn,
  ): Promise<void> {
    const currentPublicId = await readCurrent(userId);
    await this.replace(currentPublicId, newPublicId);
  }

  async removeAvatar(userId: string, readCurrent: ReadAvatarPublicIdFn): Promise<void> {
    return this.replaceAvatar(userId, null, readCurrent);
  }

  async replaceQuizCover(
    quizId: string,
    newPublicId: string | null,
    readCurrent: ReadQuizCoverPublicIdFn,
  ): Promise<void> {
    const currentPublicId = await readCurrent(quizId);
    await this.replace(currentPublicId, newPublicId);
  }

  async removeQuizCover(quizId: string, readCurrent: ReadQuizCoverPublicIdFn): Promise<void> {
    return this.replaceQuizCover(quizId, null, readCurrent);
  }

  async deleteQuizCover(quizId: string, readCurrent: ReadQuizCoverPublicIdFn): Promise<void> {
    const currentPublicId = await readCurrent(quizId);
    if (currentPublicId === null) {
      return;
    }
    await this.replace(currentPublicId, null);
  }
}
