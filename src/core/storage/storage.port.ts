/**
 * Storage port token.
 *
 * Exported as a NestJS injection `Symbol` so the adapter choice can be
 * swapped at module-construction time (real vs fake) without changing
 * the call sites. This mirrors the convention used by `core/redis` which
 * exposes `CACHE_PROVIDER` / `PUBSUB_PROVIDER` as plain string symbols.
 *
 * Consumers should import the symbol AND the type from here:
 *
 *   import { STORAGE_PORT, StoragePort } from '@/core/storage';
 *
 *   constructor(
 *     @Inject(STORAGE_PORT) private readonly storage: StoragePort,
 *   ) {}
 */

export const STORAGE_PORT = Symbol('STORAGE_PORT');

export type { UploadInput, UploadResult, UploadPurpose, StoragePort } from './storage.types';
