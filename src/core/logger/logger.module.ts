import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { createPinoHttpConfig } from './pino.config';

@Global()
@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: createPinoHttpConfig(configService),
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class CoreLoggerModule {}
