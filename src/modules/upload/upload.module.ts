/**
 * `modules/upload/` — Phase 3.
 *
 * Single endpoint (`POST /api/v1/uploads`) for avatar and quiz cover
 * uploads. Depends on `core/storage` (the port + adapter + ownership
 * service) but is otherwise self-contained.
 */

import { Module } from '@nestjs/common';

import { UploadController } from './transport/controller/upload.controller';
import { UploadApplicationService } from './application/upload.application.service';

@Module({
  controllers: [UploadController],
  providers: [UploadApplicationService],
})
export class UploadModule {}
