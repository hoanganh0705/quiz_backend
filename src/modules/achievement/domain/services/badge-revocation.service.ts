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

/** Batch size for fetching revoked badge records in statistics queries. */
const REVOCATION_STATS_LIMIT = 100;

/** Maximum number of recent revocations to include in stats response. */
const RECENT_REVOCATIONS_LIMIT = 10;

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
   *
   * NOTE: This method is not yet fully implemented.
   * - Does not emit the correct event (badge.revoked with "Reversed:" reason is wrong)
   * - Should emit badge.restored or achievement.awarded instead
   * - Original revokedBy is not stored in the revocation record
   * TODO: Implement proper badge restoration event or remove this method if not needed
   */
  async reverseRevocation(
    userId: string,
    badgeId: string,
    reversedByAdmin: string,
    reason: string,
  ): Promise<RevocationResult> {
    // Verify the badge was revoked
    const hasBadge = await this.achievementRepository.hasBadge(userId, badgeId);
    if (hasBadge) {
      return { success: false, error: 'Badge is not revoked' };
    }

    try {
      // Find the revoked record
      const { data: revokedRecords } = await this.achievementRepository.getRevokedUserBadges(
        userId,
        badgeId,
        {
          limit: 1,
        },
      );

      const revokedRecord = revokedRecords[0];
      if (!revokedRecord) {
        return { success: false, error: 'No revoked record found' };
      }

      // Re-award the badge (this clears the revokedAt and revocationReason via the unique constraint)
      const reAwarded = await this.achievementRepository.awardBadge({
        userId,
        badgeId,
        badgeVersion: revokedRecord.badgeVersion,
        earnedAt: new Date(),
        progress: revokedRecord.progress,
        metadata: revokedRecord.metadata,
        expiresAt: revokedRecord.expiresAt ?? undefined,
      });

      if (!reAwarded) {
        return { success: false, error: 'Failed to re-award badge' };
      }

      const revocation: RevocationRecord = {
        userBadgeId: revokedRecord.userBadgeId,
        userId,
        badgeId,
        badgeSlug: revokedRecord.badge.slug,
        revokedAt: revokedRecord.revokedAt ?? new Date(),
        revokedBy: 'admin', // Original revokedBy not stored in revocation record
        reason: 'Original revocation',
        reversedAt: new Date(),
        reversedBy: reversedByAdmin,
        reversedReason: reason,
      };

      this.logger.info({
        event: 'revocation_reversed',
        userId,
        badgeId,
        reversedBy: reversedByAdmin,
        reason,
      });

      const revokedAt = revokedRecord.revokedAt ?? new Date();
      const badgeSlug = revokedRecord.badge.slug;

      this.achievementDomainEventBus.emitBadgeRevoked({
        userId,
        badgeId,
        badgeSlug,
        revokedAt,
        reason: `Reversed: ${reason}`,
        revokedBy: reversedByAdmin,
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
  async getBadgeRevocationHistory(badgeId: string): Promise<RevocationRecord[]> {
    this.logger.debug({
      event: 'get_badge_revocation_history',
      badgeId,
    });

    const { data: revokedRecords } = await this.achievementRepository.getRevokedUserBadges(
      undefined,
      badgeId,
    );

    return revokedRecords.map((record) => ({
      userBadgeId: record.userBadgeId,
      userId: record.userId,
      badgeId: record.badgeId,
      badgeSlug: record.badge.slug,
      revokedAt: record.revokedAt ?? new Date(),
      revokedBy: 'admin',
      reason: record.revocationReason ?? 'Unknown',
    }));
  }

  /**
   * Get revocation history for a user.
   */
  async getUserRevocationHistory(userId: string): Promise<RevocationRecord[]> {
    this.logger.debug({
      event: 'get_user_revocation_history',
      userId,
    });

    const { data: revokedRecords } = await this.achievementRepository.getRevokedUserBadges(userId);

    return revokedRecords.map((record) => ({
      userBadgeId: record.userBadgeId,
      userId: record.userId,
      badgeId: record.badgeId,
      badgeSlug: record.badge.slug,
      revokedAt: record.revokedAt ?? new Date(),
      revokedBy: 'admin',
      reason: record.revocationReason ?? 'Unknown',
    }));
  }

  /**
   * Get revocation statistics.
   */
  async getRevocationStats(): Promise<{
    totalRevocations: number;
    byReason: Record<string, number>;
    recentRevocations: RevocationRecord[];
  }> {
    this.logger.debug({
      event: 'get_revocation_stats',
    });

    const { data: allRevokedRecords } = await this.achievementRepository.getRevokedUserBadges(
      undefined,
      undefined,
      {
        limit: REVOCATION_STATS_LIMIT,
      },
    );

    const byReason: Record<string, number> = {};
    let totalRevocations = 0;

    for (const record of allRevokedRecords) {
      totalRevocations++;
      const reason = record.revocationReason ?? 'Unknown';
      byReason[reason] = (byReason[reason] ?? 0) + 1;
    }

    const recentRevocations: RevocationRecord[] = allRevokedRecords
      .slice(0, RECENT_REVOCATIONS_LIMIT)
      .map((record) => ({
        userBadgeId: record.userBadgeId,
        userId: record.userId,
        badgeId: record.badgeId,
        badgeSlug: record.badge.slug,
        revokedAt: record.revokedAt ?? new Date(),
        revokedBy: 'admin',
        reason: record.revocationReason ?? 'Unknown',
      }));

    return {
      totalRevocations,
      byReason,
      recentRevocations,
    };
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
