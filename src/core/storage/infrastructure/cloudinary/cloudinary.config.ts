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
  result: string;
}

export interface SignedUploadPayload {
  readonly signature: string;
  readonly timestamp: number;
  readonly apiKey: string;
  readonly cloudName: string;
}

export interface CloudinarySDK {
  upload_stream(opts: Record<string, unknown>, cb: UploadStreamCallback): Transform;
  destroy(publicId: string): Promise<DestroyResult>;
  url(publicId: string, opts: Record<string, unknown>): string;
  ping(): Promise<void>;
  signRequest(params: Record<string, string | number>): Promise<SignedUploadPayload>;
}

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
      api_sign_request: (params: Record<string, string | number>, apiSecret: string) => string;
    };
  };

  return {
    upload_stream: (opts, cb) => sdk.uploader.upload_stream(opts, cb),
    destroy: (publicId) => sdk.uploader.destroy(publicId),
    url: (publicId, opts) => cloudinaryV2.url(publicId, opts),
    ping: async () => {
      const result = await sdk.api.ping();
      if (!result || result.status !== 'ok') {
        throw new Error(`Cloudinary ping returned unexpected status: ${String(result?.status)}`);
      }
    },
    signRequest: (params) => {
      const signature = sdk.utils.api_sign_request(params, config.apiSecret);
      const timestamp = params.timestamp as number;
      return Promise.resolve({
        signature,
        timestamp,
        apiKey: config.apiKey,
        cloudName: config.cloudName,
      });
    },
  };
}
