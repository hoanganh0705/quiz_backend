/**
 * Cloudinary SDK provider.
 *
 * Wraps the `cloudinary` v2 SDK and exposes a tightly-scoped surface
 * (`CloudinarySDK`) to the rest of `core/storage`. The adapter only
 * needs three methods; everything else on the SDK stays sealed here.
 *
 * The provider factory is invoked once at module init: it calls
 * `cloudinary.config({...})` exactly once, then returns the wrapped
 * instance. Multiple Nest processes (cluster mode) are safe — each
 * process calls `cloudinary.config` once with the same credentials.
 */

import { Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Transform } from 'node:stream';
import { v2 as cloudinaryV2 } from 'cloudinary';

import { cloudinaryConfig } from '@/core/config';

export const CLOUDINARY_SDK = Symbol('CLOUDINARY_SDK');

/**
 * The shape of one `upload_stream` callback. Cloudinary's typings
 * declare it as `(err: any, result: UploadApiResponse) => void`. We
 * narrow the error type for our wrapper.
 */
export type UploadStreamCallback = (
  err: Error | null | undefined,
  result: UploadStreamResult | undefined,
) => void;

export interface UploadStreamResult {
  public_id: string;
  secure_url: string;
  bytes: number;
  format: string;
  width: number;
  height: number;
}

export interface DestroyResult {
  /** Cloudinary's documented values are 'ok' or 'not found'; other strings are possible but opaque. */
  result: string;
}

/**
 * The narrow Cloudinary surface the adapter is allowed to use. Other
 * SDK methods are intentionally not exported.
 */
export interface CloudinarySDK {
  upload_stream(opts: Record<string, unknown>, cb: UploadStreamCallback): Transform;
  destroy(publicId: string): Promise<DestroyResult>;
  url(publicId: string, opts: Record<string, unknown>): string;
}

/**
 * Factory that creates the SDK wrapper. Called once per process.
 *
 * The actual `useFactory` lives in `cloudinary.module.ts` so this file
 * stays free of Nest module plumbing and is straightforward to unit-test
 * (the factory is a pure function over its inputs).
 */
export function buildCloudinarySDK(config: ConfigType<typeof cloudinaryConfig>): CloudinarySDK {
  const logger = new Logger('CloudinarySDK');

  cloudinaryV2.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
  logger.log({ event: 'cloudinary_sdk_configured', cloud_name: config.cloudName });

  const sdk = cloudinaryV2 as unknown as {
    uploader: {
      upload_stream: (opts: Record<string, unknown>, cb: UploadStreamCallback) => Transform;
      destroy: (publicId: string) => Promise<DestroyResult>;
    };
  };

  return {
    upload_stream: (opts, cb) => sdk.uploader.upload_stream(opts, cb),
    destroy: (publicId) => sdk.uploader.destroy(publicId),
    url: (publicId, opts) => cloudinaryV2.url(publicId, opts),
  };
}
