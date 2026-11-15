import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import {
  STORAGE_PORT,
  StorageModule,
  FakeStorageAdapter,
  R2StorageAdapter,
} from '../src/core/storage';
import { r2Config } from '../src/core/config';
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

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByPublicId(): Promise<
    Array<{ publicId: string; ownerId: string; purpose: 'avatar' | 'quiz' }>
  > {
    return [];
  }
}

async function runAs(adapter: 'fake' | 'r2'): Promise<string> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [r2Config],
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

  const r2Resolved = await runAs('r2');
  if (r2Resolved !== R2StorageAdapter.name) {
    console.error(
      `[smoke:storage] FAIL: 'r2' resolved to ${r2Resolved}, expected ${R2StorageAdapter.name}`,
    );
    process.exit(1);
  }
  console.log(`[smoke:storage] OK: adapter='r2' → STORAGE_PORT = ${r2Resolved}`);
}

main().catch((err) => {
  console.error('[smoke:storage] FAIL:', err);
  process.exit(1);
});
