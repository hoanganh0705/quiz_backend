/**
 * scripts/smoke-storage-module.ts
 *
 * CI smoke: verify that StorageModule.forRoot() resolves STORAGE_PORT to
 *   - FakeStorageAdapter when adapter: 'fake'
 *   - CloudinaryStorageAdapter when adapter: 'cloudinary'
 *
 * Exits 0 on success, non-zero on failure.
 *
 * Phase 4 note: the module now also exports `StorageAssetsRepository`
 * (which needs `DRIZZLE` from `DatabaseModule`) and
 * `StorageApplicationService`. The smoke here is intentionally narrow —
 * it only asserts that `STORAGE_PORT` resolves to the expected
 * adapter, so we stub out the repository with a hand-rolled fake.
 * The full DI graph is exercised by the e2e suites.
 */

import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { STORAGE_PORT, StorageModule, FakeStorageAdapter } from '../src/core/storage';
import { cloudinaryConfig } from '../src/core/config';
import {
  STORAGE_ASSETS_REPOSITORY,
  type StorageAssetsRepositoryPort,
} from '../src/core/storage/domain/ports/storage-assets-repository.port';

class NoopStorageAssetsRepository implements StorageAssetsRepositoryPort {
  async insert(): Promise<void> {
    /* no-op for the smoke */
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async existsByPublicIdOwnerAndPurpose(): Promise<boolean> {
    return false;
  }

  async deleteByPublicId(): Promise<void> {
    /* no-op for the smoke */
  }
}

async function runAs(adapter: 'fake' | 'cloudinary'): Promise<string> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [cloudinaryConfig],
      }),
      LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
      StorageModule.forRoot({ adapter }),
    ],
  })
    .overrideProvider(STORAGE_ASSETS_REPOSITORY)
    .useValue(new NoopStorageAssetsRepository())
    .compile();

  const resolved = moduleRef.get(STORAGE_PORT);
  return resolved?.constructor.name ?? 'undefined';
}

async function main(): Promise<void> {
  const fakeResolved = await runAs('fake');
  if (fakeResolved !== FakeStorageAdapter.name) {
    console.error(
      `[smoke:storage] FAIL: 'fake' resolved to ${fakeResolved}, expected ${FakeStorageAdapter.name}`,
    );
    process.exit(1);
  }
  console.log(`[smoke:storage] OK: adapter='fake' → STORAGE_PORT = ${fakeResolved}`);

  // The cloudinary adapter requires the four CLOUDINARY_* env vars to
  // be set. .env.example provides them via the local .env, so we
  // delegate loading to ConfigModule + dotenv (ConfigModule reads
  // process.env automatically).
  const cloudinaryResolved = await runAs('cloudinary');
  if (cloudinaryResolved === FakeStorageAdapter.name || cloudinaryResolved === 'undefined') {
    console.error(
      `[smoke:storage] FAIL: 'cloudinary' resolved to ${cloudinaryResolved}, expected CloudinaryStorageAdapter`,
    );
    process.exit(1);
  }
  console.log(`[smoke:storage] OK: adapter='cloudinary' → STORAGE_PORT = ${cloudinaryResolved}`);
}

main().catch((err) => {
  console.error('[smoke:storage] FAIL:', err);
  process.exit(1);
});
