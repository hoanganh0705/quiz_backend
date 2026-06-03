import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { AuthSecurityEventBusPort } from './auth-security-event-bus.port';
import type {
  PasswordResetRequestedEvent,
  PasswordResetCompletedEvent,
  PasswordChangedEvent,
  SessionRevokedEvent,
  AllOtherSessionsRevokedEvent,
  AuthSecurityEvent,
} from './auth-security.events';

@Injectable()
export class AuthSecurityEventBus implements AuthSecurityEventBusPort {
  private handlers: Array<(event: AuthSecurityEvent) => void> = [];

  constructor(@InjectPinoLogger(AuthSecurityEventBus.name) private readonly logger: PinoLogger) {}

  subscribe(handler: (event: AuthSecurityEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: AuthSecurityEvent): void {
    this.logger.info({
      event: `auth_security_${event.eventType}`,
      ...this.serializeEvent(event),
    });

    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'auth_security_event_handler_error',
          eventType: event.eventType,
          message: error instanceof Error ? error.message : 'Unknown handler error',
        });
      }
    }
  }

  private serializeEvent(event: AuthSecurityEvent): Record<string, unknown> {
    const { eventType, timestamp, ...rest } = event;
    return {
      eventType,
      timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
      ...rest,
    };
  }

  emitPasswordResetRequested(event: PasswordResetRequestedEvent): void {
    this.emit(event);
  }

  emitPasswordResetCompleted(event: PasswordResetCompletedEvent): void {
    this.emit(event);
  }

  emitPasswordChanged(event: PasswordChangedEvent): void {
    this.emit(event);
  }

  emitSessionRevoked(event: SessionRevokedEvent): void {
    this.emit(event);
  }

  emitAllOtherSessionsRevoked(event: AllOtherSessionsRevokedEvent): void {
    this.emit(event);
  }
}
