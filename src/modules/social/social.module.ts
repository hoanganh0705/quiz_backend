import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { SocialApplicationService } from './application/social-application.service';
import { SocialService } from './domain/services/social.service';
import { SocialRepository } from './infrastructure/repositories/social.repository';
import { SocialController } from './transport/controller/social.controller';
import { SocialDomainExceptionFilter } from './transport/filters/social-domain-exception.filter';
import { SOCIAL_REPOSITORY_PORT } from './domain/ports/social-ports';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [DatabaseModule, UserModule],
  providers: [
    SocialApplicationService,
    SocialService,
    SocialRepository,
    SocialDomainExceptionFilter,
    { provide: SOCIAL_REPOSITORY_PORT, useExisting: SocialRepository },
  ],
  controllers: [SocialController],
  exports: [SocialService, SocialApplicationService],
})
export class SocialModule {}
