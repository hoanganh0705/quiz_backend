import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { storageAssets } from '@/core/database/schema/storage/schema';
import type { UploadPurpose } from '../../storage.types';
import type { StorageAssetsRepositoryPort } from '../../domain/ports/storage-assets-repository.port';

/**
 * Drizzle-backed implementation of `StorageAssetsRepositoryPort`.
 *
 * All queries go through the global `DRIZZLE` token from
 * `core/database/database.module`. No other module owns this row.
 */
@Injectable()
export class StorageAssetsRepository implements StorageAssetsRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async insert(input: {
    publicId: string;
    ownerId: string;
    purpose: UploadPurpose;
  }): Promise<void> {
    await this.db.insert(storageAssets).values({
      publicId: input.publicId,
      ownerId: input.ownerId,
      purpose: input.purpose,
    });
  }

  async existsByPublicIdOwnerAndPurpose(input: {
    publicId: string;
    ownerId: string;
    purpose: UploadPurpose;
  }): Promise<boolean> {
    const rows = await this.db
      .select({ id: storageAssets.id })
      .from(storageAssets)
      .where(
        and(
          eq(storageAssets.publicId, input.publicId),
          eq(storageAssets.ownerId, input.ownerId),
          eq(storageAssets.purpose, input.purpose),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async deleteByPublicId(publicId: string): Promise<void> {
    await this.db.delete(storageAssets).where(eq(storageAssets.publicId, publicId));
  }
}
