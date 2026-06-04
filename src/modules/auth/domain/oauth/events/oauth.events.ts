export interface OAuthAccountCreatedEvent {
  readonly eventType: 'oauth_account_created';
  readonly userId: string;
  readonly provider: string;
  readonly providerUserId: string;
  readonly username: string;
  readonly timestamp: Date;
}

export interface OAuthAccountLinkedEvent {
  readonly eventType: 'oauth_account_linked';
  readonly userId: string;
  readonly provider: string;
  readonly providerUserId: string;
  readonly timestamp: Date;
}

export interface OAuthLoginEvent {
  readonly eventType: 'oauth_login';
  readonly userId: string;
  readonly provider: string;
  readonly timestamp: Date;
}

export interface OAuthLoginFailedEvent {
  readonly eventType: 'oauth_login_failed';
  readonly provider: string;
  readonly reason: string;
  readonly userId?: string;
  readonly timestamp: Date;
}

export type OAuthSecurityEvent =
  | OAuthAccountCreatedEvent
  | OAuthAccountLinkedEvent
  | OAuthLoginEvent
  | OAuthLoginFailedEvent;
