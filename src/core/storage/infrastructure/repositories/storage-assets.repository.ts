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

  async findByPublicId(
    publicId: string,
  ): Promise<Array<{ publicId: string; ownerId: string; purpose: UploadPurpose }>> {
    const rows = await this.db
      .select({
        publicId: storageAssets.publicId,
        ownerId: storageAssets.ownerId,
        purpose: storageAssets.purpose,
      })
      .from(storageAssets)
      .where(eq(storageAssets.publicId, publicId))
      .limit(1);
    // Drizzle types `purpose` as the raw column type (`string`); the
    // schema constrains it to 'avatar' | 'quiz' at the DB layer, so a
    // narrowing cast is safe here. The application service consumes
    // only the boolean `assetExists(...)` shape so a bad row would not
    // reach this cast in practice.
    return rows.map((row) => ({
      publicId: row.publicId,
      ownerId: row.ownerId,
      purpose: row.purpose as UploadPurpose,
    }));
  }
}
