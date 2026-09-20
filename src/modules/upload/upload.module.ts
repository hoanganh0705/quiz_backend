import { Module } from '@nestjs/common';

import { UploadController } from './transport/controller/upload.controller';
import { UploadApplicationService } from './application/upload.application.service';

@Module({
  controllers: [UploadController],
  providers: [UploadApplicationService],
})
export class UploadModule {}
