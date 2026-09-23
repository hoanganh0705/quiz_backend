import { Global, Module } from '@nestjs/common';
import { ReferentialValidatorService } from './referential-validator.service';

@Global()
@Module({
  providers: [ReferentialValidatorService],
  exports: [ReferentialValidatorService],
})
export class DatabaseCommonModule {}
