import { Module } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';
import { Resend } from 'resend';
import { DatabaseModule } from '@/core/database/database.module';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';
import { EMAIL_QUEUE_NAME, EMAIL_QUEUE_TOKENS } from './email.constants';
import { redisConfig, emailConfig } from '@/core/config';
import type { RedisConfig, EmailConfig } from '@/core/config';
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
        const connection: ConnectionOptions = { url: redis.url };
        if (redis.keyPrefix && redis.keyPrefix.length > 0) {
          connection.keyPrefix = redis.keyPrefix;
        }
        return connection;
      },
    },
    {
      provide: EMAIL_QUEUE_TOKENS.QUEUE,
      inject: [EMAIL_QUEUE_TOKENS.CONNECTION],
      useFactory: (connection: ConnectionOptions) => {
        return new Queue(EMAIL_QUEUE_NAME, { connection });
      },
    },
    {
      provide: EMAIL_QUEUE_TOKENS.RESEND_CLIENT,
      inject: [emailConfig.KEY],
      useFactory: (email: EmailConfig): Resend => {
        if (!email.resendApiKey) {
          throw new Error(
            'Email service is missing required configuration. Check server environment variables.',
          );
        }
        return new Resend(email.resendApiKey);
      },
    },
    EmailResilienceRunner,
    VerificationEmailHandler,
    PasswordResetEmailHandler,
    EmailService,
    EmailProcessor,
  ],
  exports: [
    EmailService,
    EMAIL_QUEUE_TOKENS.QUEUE,
    EMAIL_QUEUE_TOKENS.CONNECTION,
    EMAIL_QUEUE_TOKENS.RESEND_CLIENT,
  ],
})
export class EmailModule {}
