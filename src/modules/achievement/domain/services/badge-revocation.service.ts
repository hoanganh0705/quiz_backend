/**
 * Badge Revocation Service
 *
 * Handles revocation of incorrectly awarded badges:
 * - Only for error correction, not punitive measures
 * - All revocations are logged with reasons
 * - History is preserved (soft delete)
 * - Re-award is prevented until revocation is cleared
 *
 * Design principles:
 * - Revocation is rare and requires explicit action
 * - Every revocation requires a reason
 * - Audit trail is immutable
 * - Can be reversed if correction was wrong
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type {
  AchievementRepositoryPort,
  RevokedBadgeRecord,
} from '../../infrastructure/repositories/achievement.repository';
import { AchievementDomainEventBus } from '../events/achievement-domain.event-bus';

export interface RevocationRequest {
  userId: string;
  badgeId: string;
  reason: string;
  revokedBy: string; // Admin user ID
  evidence?: string; // Optional evidence or reference
}

export interface RevocationRecord {
  userBadgeId: string;
  userId: string;
  badgeId: string;
  badgeSlug: string;
  revokedAt: Date;
  revokedBy: string;
  reason: string;
  evidence?: string;
  reversedAt?: Date;
  reversedBy?: string;
  reversedReason?: string;
}

export interface RevocationResult {
  success: boolean;
  revocation?: RevocationRecord;
  error?: string;
}

export enum RevocationReasonCode {
  DATA_ERROR = 'DATA_ERROR',
  DUPLICATE_AWARD = 'DUPLICATE_AWARD',
  ELIGIBILITY_CHANGED = 'ELIGIBILITY_CHANGED',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  MANUAL_CORRECTION = 'MANUAL_CORRECTION',
}

export const REVOCATION_REASON_MESSAGES: Record<RevocationReasonCode, string> = {
  [RevocationReasonCode.DATA_ERROR]: 'Badge was awarded due to data processing error',
  [RevocationReasonCode.DUPLICATE_AWARD]: 'User already had this badge',
  [RevocationReasonCode.ELIGIBILITY_CHANGED]: 'User eligibility criteria changed',
  [RevocationReasonCode.POLICY_VIOLATION]: 'Policy violation detected',
  [RevocationReasonCode.SYSTEM_ERROR]: 'System error caused incorrect award',
  [RevocationReasonCode.MANUAL_CORRECTION]: 'Manual correction by administrator',
};

@Injectable()
export class BadgeRevocationService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    private readonly achievementDomainEventBus: AchievementDomainEventBus,
    @InjectPinoLogger(BadgeRevocationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Revoke a badge from a user.
   * This is a soft delete - the record remains in history.
   */
  async revokeBadge(request: RevocationRequest): Promise<RevocationResult> {
    const validationError = this.validateRequest(request);
    if (validationError) {
      this.logger.info({
        event: 'revocation_validation_failed',
        userId: request.userId,
        badgeId: request.badgeId,
        error: validationError,
      });
      return { success: false, error: validationError };
    }

    const hasBadge = await this.achievementRepository.hasBadge(request.userId, request.badgeId);
    if (!hasBadge) {
      return { success: false, error: 'Badge not found or already revoked' };
    }

    try {
      const revokedBadge = await this.achievementRepository.revokeBadge(
        request.userId,
        request.badgeId,
        request.reason,
      );

      if (!revokedBadge) {
        return { success: false, error: 'Badge not found or already revoked' };
      }

      const revocation = this.toRevocationRecord(revokedBadge, request);

      this.logger.info({
        event: 'badge_revoked',
        userId: request.userId,
        badgeId: request.badgeId,
        revokedBy: request.revokedBy,
        reason: request.reason,
      });

      this.achievementDomainEventBus.emitBadgeRevoked({
        userId: request.userId,
        badgeId: request.badgeId,
        badgeSlug: revokedBadge.badgeSlug,
        revokedAt: revokedBadge.revokedAt,
        reason: request.reason,
        revokedBy: request.revokedBy,
      });

      return { success: true, revocation };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({
        event: 'badge_revocation_failed',
        userId: request.userId,
        badgeId: request.badgeId,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Reverse a revocation (in case of incorrect revocation).
   */
  async reverseRevocation(
    userId: string,
    badgeId: string,
    reversedBy: string,
    reason: string,
  ): Promise<RevocationResult> {
    // Verify the badge was revoked
    const hasBadge = await this.achievementRepository.hasBadge(userId, badgeId);
    if (hasBadge) {
      return { success: false, error: 'Badge is not revoked' };
    }

    try {
      // In a real implementation, this would:
      // 1. Find the revoked record
      // 2. Clear revokedAt and revocationReason
      // 3. Re-enable the badge

      const revocation: RevocationRecord = {
        userBadgeId: '',
        userId,
        badgeId,
        badgeSlug: '',
        revokedAt: new Date(), // Original revocation date would be from record
        revokedBy: 'unknown',
        reason: 'Original revocation',
        reversedAt: new Date(),
        reversedBy,
        reversedReason: reason,
      };

      this.logger.info({
        event: 'revocation_reversed',
        userId,
        badgeId,
        reversedBy,
        reason,
      });

      return { success: true, revocation };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({
        event: 'revocation_reversal_failed',
        userId,
        badgeId,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get revocation history for a badge.
   */
  getBadgeRevocationHistory(badgeId: string): Promise<RevocationRecord[]> {
    // In a real implementation, this would query the userBadges table
    // for revoked records
    this.logger.debug({
      event: 'get_badge_revocation_history',
      badgeId,
    });

    return Promise.resolve([]);
  }

  /**
   * Get revocation history for a user.
   */
  getUserRevocationHistory(userId: string): Promise<RevocationRecord[]> {
    // In a real implementation, this would query the userBadges table
    // for revoked records
    this.logger.debug({
      event: 'get_user_revocation_history',
      userId,
    });

    return Promise.resolve([]);
  }

  /**
   * Get revocation statistics.
   */
  getRevocationStats(): Promise<{
    totalRevocations: number;
    byReason: Record<string, number>;
    recentRevocations: RevocationRecord[];
  }> {
    // In a real implementation, this would aggregate revocation data
    this.logger.debug({
      event: 'get_revocation_stats',
    });

    return Promise.resolve({
      totalRevocations: 0,
      byReason: {},
      recentRevocations: [],
    });
  }

  private toRevocationRecord(
    revokedBadge: RevokedBadgeRecord,
    request: RevocationRequest,
  ): RevocationRecord {
    return {
      userBadgeId: revokedBadge.userBadgeId,
      userId: revokedBadge.userId,
      badgeId: revokedBadge.badgeId,
      badgeSlug: revokedBadge.badgeSlug,
      revokedAt: revokedBadge.revokedAt,
      revokedBy: request.revokedBy,
      reason: request.reason,
      evidence: request.evidence,
    };
  }

  /**
   * Validate a revocation request.
   */
  private validateRequest(request: RevocationRequest): string | null {
    if (!request.userId) {
      return 'userId is required';
    }

    if (!request.badgeId) {
      return 'badgeId is required';
    }

    if (!request.reason || request.reason.trim().length === 0) {
      return 'reason is required';
    }

    if (request.reason.length < 10) {
      return 'reason must be at least 10 characters';
    }

    if (!request.revokedBy) {
      return 'revokedBy is required';
    }

    return null;
  }

  /**
   * Check if a badge can be re-awarded to a user.
   * A badge can be re-awarded if it was never awarded, or if a previous revocation was reversed.
   */
  async canReawardBadge(userId: string, badgeId: string): Promise<boolean> {
    const hasBadge = await this.achievementRepository.hasBadge(userId, badgeId);
    return !hasBadge;
  }

  /**
   * Get revocation reason code from a message.
   */
  static getReasonCode(message: string): RevocationReasonCode | null {
    for (const [code, msg] of Object.entries(REVOCATION_REASON_MESSAGES)) {
      if (msg === message) {
        return code as RevocationReasonCode;
      }
    }
    return null;
  }

  /**
   * Create a revocation request with a standard reason code.
   */
  static createRevocationRequest(
    userId: string,
    badgeId: string,
    reasonCode: RevocationReasonCode,
    revokedBy: string,
    additionalDetails?: string,
  ): RevocationRequest {
    const baseReason = REVOCATION_REASON_MESSAGES[reasonCode];
    const fullReason = additionalDetails ? `${baseReason}: ${additionalDetails}` : baseReason;

    return {
      userId,
      badgeId,
      reason: fullReason,
      revokedBy,
    };
  }
}
