import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [CommonModule, DatabaseModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
