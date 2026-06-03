import type {
  PasswordResetRequestedEvent,
  PasswordResetCompletedEvent,
  PasswordChangedEvent,
  SessionRevokedEvent,
  AllOtherSessionsRevokedEvent,
  AuthSecurityEvent,
} from './auth-security.events';

export interface AuthSecurityEventBusPort {
  subscribe(handler: (event: AuthSecurityEvent) => void): () => void;
  emitPasswordResetRequested(event: PasswordResetRequestedEvent): void;
  emitPasswordResetCompleted(event: PasswordResetCompletedEvent): void;
  emitPasswordChanged(event: PasswordChangedEvent): void;
  emitSessionRevoked(event: SessionRevokedEvent): void;
  emitAllOtherSessionsRevoked(event: AllOtherSessionsRevokedEvent): void;
}

export const AUTH_SECURITY_EVENT_BUS = Symbol('AUTH_SECURITY_EVENT_BUS');
