import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { pinoHttpConfig } from './pino.config';

@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: pinoHttpConfig,
    }),
  ],
  exports: [LoggerModule],
})
export class CoreLoggerModule {}
