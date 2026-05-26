import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DatabaseModule } from '@/core/database/database.module';
import { UserRepository } from '@/core/database/repositories/user.repository';
import { USER_REPOSITORY_PORT } from './domain/ports/user-repository.port';

@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [UserService, { provide: USER_REPOSITORY_PORT, useExisting: UserRepository }],
  exports: [USER_REPOSITORY_PORT],
})
export class UserModule {}
