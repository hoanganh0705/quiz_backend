/**
 * Cloudinary configuration.
 *
 * Provides typed access to the `CLOUDINARY_*` environment variables that
 * Phase 0 added. The four values are validated at startup by
 * `validateEnv()` (see `env.validation.ts`), so by the time the provider
 * factory runs they are guaranteed non-empty and well-formed.
 *
 * `folder` carries the `quiz-app-dev` default for non-production; the
 * production `.env` is expected to override with `quiz-app`.
 */

import { ConfigType, registerAs } from '@nestjs/config';

export const cloudinaryConfig = registerAs('cloudinary', () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  apiKey: process.env.CLOUDINARY_API_KEY ?? '',
  apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  folder: process.env.CLOUDINARY_FOLDER ?? 'quiz-app-dev',
}));

export type CloudinaryConfig = ConfigType<typeof cloudinaryConfig>;
