/**
 * Auth Security Notification Service
 *
 * Composes and sends notifications for sensitive security events (password changes,
 * account deletions, session revocations) to alert users of account activity.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationChannelService } from '../../infrastructure/adapters/notification-channel.service';

export type AuthSecurityNotificationType =
  | 'password_changed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'account_deleted'
  | 'session_revoked'
  | 'all_other_sessions_revoked'
  | 'oauth_linked'
  | 'oauth_unlinked';

export interface PasswordChangedParams {
  userId: string;
  ipAddress?: string | null;
}

export interface PasswordResetRequestedParams {
  userId: string;
  ipAddress?: string | null;
}

export interface PasswordResetCompletedParams {
  userId: string;
  ipAddress?: string | null;
}

export interface AccountDeletedParams {
  userId: string;
  ipAddress?: string | null;
}

export interface SessionRevokedParams {
  userId: string;
  sessionId: string;
  ipAddress?: string | null;
}

export interface AllSessionsRevokedParams {
  userId: string;
  revokedSessionCount: number;
  ipAddress?: string | null;
}

export interface OAuthLinkedParams {
  userId: string;
  provider: string;
}

export interface OAuthUnlinkedParams {
  userId: string;
  provider: string;
}

@Injectable()
export class AuthSecurityNotificationService {
  constructor(
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(AuthSecurityNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async notifyPasswordChanged(params: PasswordChangedParams): Promise<void> {
    const location = params.ipAddress ? ` from ${params.ipAddress}` : '';
    const body = `Your account password was changed${location}. If this wasn't you, please secure your account immediately.`;

    await this.channelService.send({
      userId: params.userId,
      type: 'password_changed',
      title: 'Password Changed',
      body,
      metadata: {
        ipAddress: params.ipAddress ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.info({
      event: 'password_changed_notification_sent',
      userId: params.userId,
      ipAddress: params.ipAddress,
    });
  }

  async notifyPasswordResetRequested(params: PasswordResetRequestedParams): Promise<void> {
    const location = params.ipAddress ? ` from ${params.ipAddress}` : '';
    const body = `A password reset was requested for your account${location}. If this wasn't you, ignore this email.`;

    await this.channelService.send({
      userId: params.userId,
      type: 'password_reset_requested',
      title: 'Password Reset Requested',
      body,
      metadata: {
        ipAddress: params.ipAddress ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.info({
      event: 'password_reset_requested_notification_sent',
      userId: params.userId,
      ipAddress: params.ipAddress,
    });
  }

  async notifyPasswordResetCompleted(params: PasswordResetCompletedParams): Promise<void> {
    const location = params.ipAddress ? ` from ${params.ipAddress}` : '';
    const body = `Your password was successfully reset${location}.`;

    await this.channelService.send({
      userId: params.userId,
      type: 'password_reset_completed',
      title: 'Password Reset Completed',
      body,
      metadata: {
        ipAddress: params.ipAddress ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.info({
      event: 'password_reset_completed_notification_sent',
      userId: params.userId,
      ipAddress: params.ipAddress,
    });
  }

  async notifyAccountDeleted(params: AccountDeletedParams): Promise<void> {
    const body = 'Your account has been permanently deleted. We hope to see you again!';

    await this.channelService.send({
      userId: params.userId,
      type: 'account_deleted',
      title: 'Account Deleted',
      body,
      metadata: {
        ipAddress: params.ipAddress ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.info({
      event: 'account_deleted_notification_sent',
      userId: params.userId,
      ipAddress: params.ipAddress,
    });
  }

  async notifySessionRevoked(params: SessionRevokedParams): Promise<void> {
    const location = params.ipAddress ? ` from ${params.ipAddress}` : '';
    const body = `One of your sessions was revoked${location}.`;

    await this.channelService.send({
      userId: params.userId,
      type: 'session_revoked',
      title: 'Session Revoked',
      body,
      metadata: {
        sessionId: params.sessionId,
        ipAddress: params.ipAddress ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.info({
      event: 'session_revoked_notification_sent',
      userId: params.userId,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
    });
  }

  async notifyAllSessionsRevoked(params: AllSessionsRevokedParams): Promise<void> {
    const location = params.ipAddress ? ` from ${params.ipAddress}` : '';
    const body = `${params.revokedSessionCount} other session(s) were revoked${location}.`;

    await this.channelService.send({
      userId: params.userId,
      type: 'all_other_sessions_revoked',
      title: 'Sessions Revoked',
      body,
      metadata: {
        revokedSessionCount: params.revokedSessionCount,
        ipAddress: params.ipAddress ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.info({
      event: 'all_sessions_revoked_notification_sent',
      userId: params.userId,
      revokedSessionCount: params.revokedSessionCount,
      ipAddress: params.ipAddress,
    });
  }

  async notifyOAuthLinked(params: OAuthLinkedParams): Promise<void> {
    const body = `Your account was linked to ${params.provider}.`;

    await this.channelService.send({
      userId: params.userId,
      type: 'oauth_linked',
      title: 'Account Linked',
      body,
      metadata: {
        provider: params.provider,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.info({
      event: 'oauth_linked_notification_sent',
      userId: params.userId,
      provider: params.provider,
    });
  }

  async notifyOAuthUnlinked(params: OAuthUnlinkedParams): Promise<void> {
    const body = `Your ${params.provider} account was unlinked from your account.`;

    await this.channelService.send({
      userId: params.userId,
      type: 'oauth_unlinked',
      title: 'Account Unlinked',
      body,
      metadata: {
        provider: params.provider,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.info({
      event: 'oauth_unlinked_notification_sent',
      userId: params.userId,
      provider: params.provider,
    });
  }
}
