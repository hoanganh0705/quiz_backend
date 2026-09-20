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
  readonly adapter?: StorageAdapterKind;
}

function defaultAdapterFromEnv(): StorageAdapterKind {
  return process.env.NODE_ENV === 'test' ? 'fake' : 'cloudinary';
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
