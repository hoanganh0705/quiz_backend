import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, type ConnectionOptions } from 'bullmq';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';
import { EMAIL_QUEUE_NAME, EMAIL_QUEUE_TOKENS } from './email.constants';

@Module({
  providers: [
    {
      provide: EMAIL_QUEUE_TOKENS.CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ConnectionOptions => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl || redisUrl.trim().length === 0) {
          throw new Error('REDIS_URL is not defined in environment variables');
        }

        return {
          url: redisUrl,
        };
      },
    },
    {
      provide: EMAIL_QUEUE_TOKENS.QUEUE,
      inject: [EMAIL_QUEUE_TOKENS.CONNECTION],
      useFactory: (connection: ConnectionOptions) => {
        return new Queue(EMAIL_QUEUE_NAME, { connection });
      },
    },
    EmailService,
    EmailProcessor,
  ],
  exports: [EmailService],
})
export class EmailModule {}
