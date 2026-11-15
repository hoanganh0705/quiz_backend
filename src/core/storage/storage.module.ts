import { type DynamicModule, Module, type Provider } from '@nestjs/common';

import { StorageApplicationService } from './application/storage.application.service';
import { StorageImageLifecycleService } from './application/storage-image-lifecycle.service';
import { StorageAssetsRepository } from './infrastructure/repositories/storage-assets.repository';
import { R2StorageModule, R2StorageAdapter } from './infrastructure/r2/r2.module';
import { FakeStorageAdapter } from './infrastructure/fake/fake-storage.adapter';
import { STORAGE_ASSETS_REPOSITORY } from './domain/ports/storage-assets-repository.port';
import { STORAGE_PORT } from './storage.port';

export type StorageAdapterKind = 'fake' | 'r2';

export interface StorageModuleOptions {
  readonly adapter?: StorageAdapterKind;
}

function defaultAdapterFromEnv(): StorageAdapterKind {
  if (process.env.NODE_ENV === 'test') {
    return 'fake';
  }
  const configured = (process.env.STORAGE_ADAPTER ?? '').trim().toLowerCase();
  if (configured === 'fake') {
    return 'fake';
  }
  return 'r2';
}

@Module({})
export class StorageModule {
  static forRoot(options: StorageModuleOptions = {}): DynamicModule {
    const adapter: StorageAdapterKind = options.adapter ?? defaultAdapterFromEnv();

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

    const providers: Provider[] = [
      ...sharedProviders,
      R2StorageAdapter,
      { provide: STORAGE_PORT, useExisting: R2StorageAdapter },
    ];
    return {
      module: StorageModule,
      global: true,
      imports: [R2StorageModule],
      providers,
      exports: [
        STORAGE_PORT,
        R2StorageAdapter,
        StorageApplicationService,
        StorageImageLifecycleService,
        STORAGE_ASSETS_REPOSITORY,
      ],
    };
  }
}
