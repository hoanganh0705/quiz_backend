import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { LoggerModule } from 'nestjs-pino';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './core/database/database.module';
import { CommonModule } from './common/common.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req, res) => {
          const existingId = req.headers['x-request-id'];
          const requestId =
            typeof existingId === 'string'
              ? existingId
              : Array.isArray(existingId)
                ? existingId[0]
                : randomUUID();

          res.setHeader('x-request-id', requestId);
          return requestId;
        },
        customProps: (req) => ({
          requestId: req.id,
        }),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'SYS:standard',
                },
              },
        customSuccessObject: (req, res, responseTime) => ({
          event: 'http_request_completed',
          responseTime: Number(responseTime),
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
        }),
        customErrorObject: (req, res, error, responseTime) => ({
          event: 'http_request_failed',
          responseTime: Number(responseTime),
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          errName: error.name,
        }),
      },
    }),
    DatabaseModule,
    UserModule,
    AuthModule,
    CommonModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
