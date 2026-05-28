import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserApplicationService } from './application/user.application.service';
import { UserDomainService } from './domain/user.service';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { DatabaseModule } from '@/core/database/database.module';
import { USER_REPOSITORY_PORT } from './domain/ports/user-repository.port';
import { UserDomainExceptionFilter } from './transport/filters/user-domain-exception.filter';

@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [
    UserApplicationService,
    UserDomainService,
    UserRepository,
    { provide: USER_REPOSITORY_PORT, useClass: UserRepository },
    UserDomainExceptionFilter,
  ],
  exports: [UserApplicationService, USER_REPOSITORY_PORT],
})
export class UserModule {}
