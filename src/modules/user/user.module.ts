import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserApplicationService } from './application/user.application.service';
import { UserDomainService } from './domain/user.service';
import { UserRepository } from './infrastructure/user.repository';
import { DatabaseModule } from '@/core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [
    UserApplicationService,
    UserDomainService,
    UserRepository,
  ],
  exports: [UserApplicationService],
})
export class UserModule {}
