import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { AuthSecurityEventPublisherPort } from './auth-security-event-bus.port';
import type {
  PasswordResetRequestedEvent,
  PasswordResetCompletedEvent,
  PasswordChangedEvent,
  SessionRevokedEvent,
  AllOtherSessionsRevokedEvent,
} from './auth-security.events';

@Injectable()
export class AuthSecurityEventPublisher implements AuthSecurityEventPublisherPort {
  constructor(
    @InjectPinoLogger(AuthSecurityEventPublisher.name) private readonly logger: PinoLogger,
  ) {}

  private serialize(eventType: string, data: Record<string, unknown>): Record<string, unknown> {
    const { timestamp, ...rest } = data;
    return {
      eventType,
      timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
      ...rest,
    };
  }

  publishPasswordResetRequested(event: PasswordResetRequestedEvent): void {
    this.logger.info({
      event: 'auth_security_password_reset_requested',
      ...this.serialize(event.eventType, event as unknown as Record<string, unknown>),
    });
  }

  publishPasswordResetCompleted(event: PasswordResetCompletedEvent): void {
    this.logger.info({
      event: 'auth_security_password_reset_completed',
      ...this.serialize(event.eventType, event as unknown as Record<string, unknown>),
    });
  }

  publishPasswordChanged(event: PasswordChangedEvent): void {
    this.logger.info({
      event: 'auth_security_password_changed',
      ...this.serialize(event.eventType, event as unknown as Record<string, unknown>),
    });
  }

  publishSessionRevoked(event: SessionRevokedEvent): void {
    this.logger.info({
      event: 'auth_security_session_revoked',
      ...this.serialize(event.eventType, event as unknown as Record<string, unknown>),
    });
  }

  publishAllOtherSessionsRevoked(event: AllOtherSessionsRevokedEvent): void {
    this.logger.info({
      event: 'auth_security_all_other_sessions_revoked',
      ...this.serialize(event.eventType, event as unknown as Record<string, unknown>),
    });
  }
}
