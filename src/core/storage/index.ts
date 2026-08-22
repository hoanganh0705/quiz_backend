/**
 * `core/storage` barrel.
 *
 * Consumers should import from here, not from sub-paths:
 *
 *   import { STORAGE_PORT, StorageModule, type StoragePort } from '@/core/storage';
 *
 * The two adapters (`FakeStorageAdapter`, `CloudinaryStorageAdapter`) are
 * also exported so tests can reach `clear()` on the fake and so future
 * modules can take a direct dependency on a specific adapter if they
 * have to (none do today).
 */

export { STORAGE_PORT } from './storage.port';
export { UPLOAD_POLICY } from './domain/upload-policy';
export type { UploadPolicy } from './domain/upload-policy';
export type {
  StoragePort,
  UploadInput,
  UploadResult,
  UploadPurpose,
  SignedUpload,
} from './storage.types';

export {
  STORAGE_ASSETS_REPOSITORY,
  type StorageAssetsRepositoryPort,
} from './domain/ports/storage-assets-repository.port';

export { StorageModule } from './storage.module';
export type { StorageAdapterKind, StorageModuleOptions } from './storage.module';

export { StorageAssetsRepository } from './infrastructure/repositories/storage-assets.repository';
export { FakeStorageAdapter } from './infrastructure/fake/fake-storage.adapter';
export {
  CloudinaryModule,
  CloudinaryStorageAdapter,
} from './infrastructure/cloudinary/cloudinary.module';

export {
  StorageApplicationService,
  StorageOwnershipBindFailedError,
} from './application/storage.application.service';
