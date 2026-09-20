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

  private async replace(currentPublicId: string | null, newPublicId: string | null): Promise<void> {
    if (currentPublicId === null || currentPublicId === newPublicId) {
      return;
    }

    await this.tryDeleteWithRetry(currentPublicId, 2);
    // Swallow unbinding errors: the asset row may already be missing
    // (e.g. earlier delete cascade), and that must not surface as an
    // unhandled rejection after the cover-image deletion has succeeded.
    try {
      await this.storageApplication.unbindAsset(currentPublicId);
    } catch {
      // intentional swallow — see comment above
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
