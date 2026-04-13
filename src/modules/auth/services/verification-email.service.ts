import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AuthConfig } from '../auth.config';

@Injectable()
export class VerificationEmailService {
  constructor(
    private readonly authConfig: AuthConfig,
    @InjectPinoLogger(VerificationEmailService.name) private readonly logger: PinoLogger,
  ) {}

  sendVerificationEmail(email: string, token: string): void {
    const verificationUrl = `${this.authConfig.emailVerificationBaseUrl}?token=${encodeURIComponent(token)}`;

    // Placeholders to configure in real email provider integration:
    // - EMAIL_FROM_ADDRESS
    // - EMAIL_FROM_NAME
    // - EMAIL_PROVIDER (ses/smtp/sendgrid/...)
    const fromAddress = this.authConfig.emailFromAddress;
    const fromName = this.authConfig.emailFromName;
    const provider = this.authConfig.emailProvider;

    // Placeholder delivery adapter. Replace with queue/provider (SES/SMTP) in production.
    this.logger.info({
      event: 'auth_verification_email_queued',
      email,
      fromAddress,
      fromName,
      provider,
      verificationUrl,
    });
  }
}
