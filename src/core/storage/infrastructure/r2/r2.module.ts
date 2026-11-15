import { Module, type Provider } from '@nestjs/common';
import { r2Config } from '@/core/config';
import { R2StorageAdapter } from './r2.adapter';
import { buildR2S3Client, R2_S3_CLIENT } from './r2.client';

const r2ClientProvider: Provider = {
  provide: R2_S3_CLIENT,
  useFactory: buildR2S3Client,
  inject: [r2Config.KEY],
};

export { R2StorageAdapter };

@Module({
  providers: [r2ClientProvider, R2StorageAdapter],
  exports: [R2_S3_CLIENT, R2StorageAdapter],
})
export class R2StorageModule {}
