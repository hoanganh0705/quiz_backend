import { Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { r2Config } from '@/core/config';

export const R2_S3_CLIENT = Symbol('R2_S3_CLIENT');

export function buildR2S3Client(config: ConfigType<typeof r2Config>): S3Client {
  const logger = new Logger('R2S3Client');

  const endpoint =
    config.endpoint ||
    (config.accountId ? `https://${config.accountId}.r2.cloudflarestorage.com` : undefined);

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  logger.log({
    event: 'r2_s3_client_configured',
    bucket: config.bucketName,
    endpoint: endpoint ?? '(unset)',
  });

  return client;
}
