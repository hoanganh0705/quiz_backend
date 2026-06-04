export interface AccountDeletedEvent {
  readonly eventType: 'account_deleted';
  readonly userId: string;
  readonly timestamp: Date;
  readonly ipAddress?: string;
}

export interface PasswordResetRequestedEvent {
  readonly eventType: 'password_reset_requested';
  readonly userId: string;
  readonly timestamp: Date;
  readonly ipAddress?: string;
}

export interface PasswordResetCompletedEvent {
  readonly eventType: 'password_reset_completed';
  readonly userId: string;
  readonly timestamp: Date;
  readonly ipAddress?: string;
}

export interface PasswordChangedEvent {
  readonly eventType: 'password_changed';
  readonly userId: string;
  readonly timestamp: Date;
  readonly ipAddress?: string;
}

export interface SessionRevokedEvent {
  readonly eventType: 'session_revoked';
  readonly userId: string;
  readonly sessionId: string;
  readonly timestamp: Date;
  readonly revokedByIp?: string;
}

export interface AllOtherSessionsRevokedEvent {
  readonly eventType: 'all_other_sessions_revoked';
  readonly userId: string;
  readonly currentSessionId: string;
  readonly revokedSessionCount: number;
  readonly timestamp: Date;
  readonly ipAddress?: string;
}

export type AuthSecurityEvent =
  | AccountDeletedEvent
  | PasswordResetRequestedEvent
  | PasswordResetCompletedEvent
  | PasswordChangedEvent
  | SessionRevokedEvent
  | AllOtherSessionsRevokedEvent;
