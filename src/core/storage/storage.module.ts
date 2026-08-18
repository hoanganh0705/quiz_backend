/**
 * `core/storage` module.
 *
 * The whole point of this module is to decouple the rest of the app
 * from Cloudinary. Domain modules inject `STORAGE_PORT`; which adapter
 * resolves the token is a build-time choice.
 *
 * `forRoot({ adapter })` returns a `DynamicModule` that swaps the
 * binding. Two adapters are supported today:
 *
 *   - `'fake'`       — `FakeStorageAdapter` (in-memory Map). Used by tests.
 *   - `'cloudinary'` — `CloudinaryStorageAdapter` (Phase 2). Used in
 *                       dev / staging / prod.
 *
 * The default is resolved from `process.env.NODE_ENV` at the time
 * `forRoot` is invoked: `NODE_ENV === 'test'` → `'fake'`, otherwise
 * `'cloudinary'`. Tests are free to override either way.
 *
 * Both adapter modules are imported at the top of this file. Neither
 * has side effects at import time (the cloudinary SDK is only
 * configured inside a Nest provider factory, not at module load), so
 * the dual import is free at boot.
 *
 * The module also exports `StorageApplicationService` (Phase 4 — the
 * §11 ownership-rule gate) and `StorageAssetsRepository` (Phase 4 —
 * the underlying Drizzle port). Both are global because every module
 * that takes a `publicId` writes one of these two services.
 */

import { type DynamicModule, Module, type Provider } from '@nestjs/common';

import { StorageApplicationService } from './application/storage.application.service';
import { StorageImageLifecycleService } from './application/storage-image-lifecycle.service';
import { StorageAssetsRepository } from './infrastructure/repositories/storage-assets.repository';
import {
  CloudinaryModule,
  CloudinaryStorageAdapter,
} from './infrastructure/cloudinary/cloudinary.module';
import { FakeStorageAdapter } from './infrastructure/fake/fake-storage.adapter';
import { STORAGE_ASSETS_REPOSITORY } from './domain/ports/storage-assets-repository.port';
import { STORAGE_PORT } from './storage.port';

export type StorageAdapterKind = 'fake' | 'cloudinary';

export interface StorageModuleOptions {
  /** Which adapter resolves `STORAGE_PORT`. Defaults to `NODE_ENV`-driven. */
  readonly adapter?: StorageAdapterKind;
}

function defaultAdapterFromEnv(): StorageAdapterKind {
  return process.env.NODE_ENV === 'test' ? 'fake' : 'cloudinary';
}

@Module({})
export class StorageModule {
  static forRoot(options: StorageModuleOptions = {}): DynamicModule {
    const adapter: StorageAdapterKind = options.adapter ?? defaultAdapterFromEnv();

    // Cross-cutting providers that exist regardless of adapter choice.
    // `StorageAssetsRepository` is registered globally by
    // `DatabaseModule` (it owns the db executor), so we only need to
    // alias it to `STORAGE_ASSETS_REPOSITORY` here.
    const sharedProviders: Provider[] = [
      { provide: STORAGE_ASSETS_REPOSITORY, useExisting: StorageAssetsRepository },
      StorageApplicationService,
      StorageImageLifecycleService,
    ];

    if (adapter === 'fake') {
      const providers: Provider[] = [
        ...sharedProviders,
        FakeStorageAdapter,
        { provide: STORAGE_PORT, useExisting: FakeStorageAdapter },
      ];
      return {
        module: StorageModule,
        global: true,
        providers,
        exports: [
          STORAGE_PORT,
          FakeStorageAdapter,
          StorageApplicationService,
          StorageImageLifecycleService,
          STORAGE_ASSETS_REPOSITORY,
        ],
      };
    }

    return {
      module: StorageModule,
      global: true,
      imports: [CloudinaryModule],
      providers: [
        ...sharedProviders,
        CloudinaryStorageAdapter,
        { provide: STORAGE_PORT, useExisting: CloudinaryStorageAdapter },
      ],
      exports: [
        STORAGE_PORT,
        CloudinaryStorageAdapter,
        StorageApplicationService,
        StorageImageLifecycleService,
        STORAGE_ASSETS_REPOSITORY,
      ],
    };
  }
}
