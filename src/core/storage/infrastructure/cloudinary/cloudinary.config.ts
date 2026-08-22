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
 * Phase 7 #1 — signed upload payload. Cloudinary's `utils.api_sign_request`
 * computes an HMAC-SHA1 signature over the request params; the caller
 * POSTs the file to a fixed `https://api.cloudinary.com/v1_1/<cloud>/auto/upload`
 * endpoint with `file`, `api_key`, `timestamp`, `signature`, and `public_id`
 * form fields.
 */
export interface SignedUploadPayload {
  /** Signature value (hex-encoded SHA-1). */
  readonly signature: string;
  /** Unix timestamp (seconds) when the signature was generated. */
  readonly timestamp: number;
  /** Server-side `api_key` the client must include. */
  readonly apiKey: string;
  /** Cloudinary cloud name (already part of the upload URL). */
  readonly cloudName: string;
}

/**
 * The narrow Cloudinary surface the adapter is allowed to use. Other
 * SDK methods are intentionally not exported.
 */
export interface CloudinarySDK {
  upload_stream(opts: Record<string, unknown>, cb: UploadStreamCallback): Transform;
  destroy(publicId: string): Promise<DestroyResult>;
  url(publicId: string, opts: Record<string, unknown>): string;
  /**
   * Phase 2 #3 — health probe. Calls Cloudinary's admin API
   * `ping` endpoint. Resolves on success, rejects on any error.
   */
  ping(): Promise<void>;
  /**
   * Phase 7 #1 — sign an upload request. Returns the `api_key`,
   * `timestamp`, and `signature` Cloudinary expects in the upload
   * form data. The caller constructs the full `public_id` (so the
   * server-side folder/owner shape is preserved) and passes the
   * params to `signRequest` together with whatever other form
   * fields should be locked by the signature.
   */
  signRequest(params: Record<string, string | number>): Promise<SignedUploadPayload>;
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
    api: {
      ping: () => Promise<{ status: string }>;
    };
    utils: {
      api_sign_request: (
        params: Record<string, string | number>,
        apiSecret: string,
      ) => string;
    };
  };

  return {
    upload_stream: (opts, cb) => sdk.uploader.upload_stream(opts, cb),
    destroy: (publicId) => sdk.uploader.destroy(publicId),
    url: (publicId, opts) => cloudinaryV2.url(publicId, opts),
    ping: async () => {
      // Cloudinary's `api.ping()` returns `{ status: 'ok' }` on success.
      // Any other response (or thrown error) is treated as a probe failure.
      const result = await sdk.api.ping();
      if (!result || result.status !== 'ok') {
        throw new Error(`Cloudinary ping returned unexpected status: ${String(result?.status)}`);
      }
    },
    signRequest: async (params) => {
      // The signature is HMAC-SHA1 of `key1=value1&key2=value2&...` joined
      // alphabetically, with the apiSecret as the HMAC key.
      const signature = sdk.utils.api_sign_request(params, config.apiSecret);
      const timestamp = params.timestamp as number;
      return {
        signature,
        timestamp,
        apiKey: config.apiKey,
        cloudName: config.cloudName,
      };
    },
  };
}
