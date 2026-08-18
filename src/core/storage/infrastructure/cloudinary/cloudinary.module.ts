/**
 * `CloudinaryModule` — the only Nest module that imports the cloudinary
 * SDK at module-init time. Registered into `StorageModule.forRoot({
 * adapter: 'cloudinary' })`.
 *
 * The `CLOUDINARY_SDK` provider is a `useFactory` that reads the
 * `cloudinary` namespaced config and calls `cloudinary.v2.config({...})`
 * exactly once. The adapter (`CloudinaryStorageAdapter`) only depends
 * on the narrow `CloudinarySDK` interface, not on the SDK module.
 *
 * We rely on the global `ConfigModule` (set up in `app.module.ts`) to
 * expose the `cloudinary` namespace via `cloudinaryConfig.KEY`. This
 * module deliberately does NOT re-import `ConfigModule` — a per-module
 * `ConfigModule.forRoot()` would create a second instance whose
 * loaded configs would not match the global namespace.
 */

import { Module, type Provider } from '@nestjs/common';

import { cloudinaryConfig } from '@/core/config';

import { CloudinaryStorageAdapter } from './cloudinary.adapter';
import { buildCloudinarySDK, CLOUDINARY_SDK } from './cloudinary.config';

const cloudinarySdkProvider: Provider = {
  provide: CLOUDINARY_SDK,
  useFactory: buildCloudinarySDK,
  inject: [cloudinaryConfig.KEY],
};

export { CloudinaryStorageAdapter };

@Module({
  providers: [cloudinarySdkProvider, CloudinaryStorageAdapter],
  exports: [CLOUDINARY_SDK, CloudinaryStorageAdapter],
})
export class CloudinaryModule {}
