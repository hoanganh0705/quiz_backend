import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { InstanceService } from './domain/instance.service';
import { InstanceController } from './transport/controller/instance.controller';
import { InstanceGateway } from './transport/gateway/instance.gateway';
import { InstanceResponseMapper } from './mappers/instance-response.mapper';
import { InstanceDomainExceptionFilter } from './transport/filters/instance-domain-exception.filter';
import { WsExceptionFilter } from './transport/filters/ws-exception.filter';
import { QUIZ_INSTANCE_REPOSITORY_PORT } from './domain/ports';
import { QuizInstanceRepository } from './infrastructure/repositories/quiz-instance.repository';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_TOKEN_SECRET') ?? '',
        signOptions: {
          expiresIn: '1d',
        },
      }),
    }),
  ],
  providers: [
    // Domain
    InstanceService,

    // Gateway
    InstanceGateway,

    // Mapper
    InstanceResponseMapper,

    // Exception filters
    InstanceDomainExceptionFilter,
    WsExceptionFilter,

    // Repository
    QuizInstanceRepository,

    // Port bindings
    { provide: QUIZ_INSTANCE_REPOSITORY_PORT, useExisting: QuizInstanceRepository },
  ],
  controllers: [InstanceController],
  exports: [InstanceService, QUIZ_INSTANCE_REPOSITORY_PORT],
})
export class InstanceModule {}
