import type {
  PasswordResetRequestedEvent,
  PasswordResetCompletedEvent,
  PasswordChangedEvent,
  SessionRevokedEvent,
  AllOtherSessionsRevokedEvent,
} from './auth-security.events';

export interface AuthSecurityEventPublisherPort {
  publishPasswordResetRequested(event: PasswordResetRequestedEvent): void;
  publishPasswordResetCompleted(event: PasswordResetCompletedEvent): void;
  publishPasswordChanged(event: PasswordChangedEvent): void;
  publishSessionRevoked(event: SessionRevokedEvent): void;
  publishAllOtherSessionsRevoked(event: AllOtherSessionsRevokedEvent): void;
}

export const AUTH_SECURITY_EVENT_BUS = Symbol('AUTH_SECURITY_EVENT_BUS');
