import { Module } from '@nestjs/common';
import { SupportService } from './application/support.service';
import { SupportController } from './transport/controller/support.controller';

@Module({
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
