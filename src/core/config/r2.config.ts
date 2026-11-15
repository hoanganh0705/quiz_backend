import { ConfigType, registerAs } from '@nestjs/config';

export const r2Config = registerAs('r2', () => {
  const accountId = (process.env.R2_ACCOUNT_ID ?? '').trim();
  const defaultEndpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '';
  const publicUrl = (process.env.R2_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');

  return {
    accountId,
    accessKeyId: (process.env.R2_ACCESS_KEY_ID ?? '').trim(),
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY ?? '').trim(),
    bucketName: (process.env.R2_BUCKET_NAME ?? 'quiz-app-assets').trim(),
    endpoint: (process.env.R2_ENDPOINT ?? '').trim() || defaultEndpoint,
    publicUrl,
    folder: (process.env.R2_FOLDER ?? 'quiz-app').trim(),
  };
});

export type R2Config = ConfigType<typeof r2Config>;
