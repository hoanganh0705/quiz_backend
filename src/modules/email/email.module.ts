import { Module } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';
import { DatabaseModule } from '@/core/database/database.module';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';
import { EMAIL_QUEUE_NAME, EMAIL_QUEUE_TOKENS } from './email.constants';
import { redisConfig } from '@/core/config';
import type { RedisConfig } from '@/core/config';
import { VerificationEmailHandler } from './handlers/verification.handler';
import { PasswordResetEmailHandler } from './handlers/password-reset.handler';
import { EmailResilienceRunner } from './resilience/email-resilience.runner';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: EMAIL_QUEUE_TOKENS.CONNECTION,
      inject: [redisConfig.KEY],
      useFactory: (redis: RedisConfig): ConnectionOptions => {
        if (!redis.url) {
          throw new Error('REDIS_URL is not defined in environment variables');
        }
        return { url: redis.url };
      },
    },
    {
      provide: EMAIL_QUEUE_TOKENS.QUEUE,
      inject: [EMAIL_QUEUE_TOKENS.CONNECTION],
      useFactory: (connection: ConnectionOptions) => {
        return new Queue(EMAIL_QUEUE_NAME, { connection });
      },
    },
    // One runner per process — the circuit-breaker listener is
    // registered in its constructor and must fire exactly once per
    // process. Handlers below consume the same instance via DI.
    EmailResilienceRunner,
    VerificationEmailHandler,
    PasswordResetEmailHandler,
    EmailService,
    EmailProcessor,
  ],
  exports: [EmailService, EMAIL_QUEUE_TOKENS.QUEUE, EMAIL_QUEUE_TOKENS.CONNECTION],
})
export class EmailModule {}
