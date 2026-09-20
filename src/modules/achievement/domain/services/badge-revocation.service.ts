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
  revokedBy: string;
  evidence?: string;
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

const REVOCATION_STATS_LIMIT = 100;
const RECENT_REVOCATIONS_LIMIT = 10;
const MIN_REASON_LENGTH = 10;
const DEFAULT_REVOKED_BY = 'unknown';

@Injectable()
export class BadgeRevocationService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    private readonly achievementDomainEventBus: AchievementDomainEventBus,
    @InjectPinoLogger(BadgeRevocationService.name)
    private readonly logger: PinoLogger,
  ) {}

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

    try {
      const hasBadge = await this.achievementRepository.hasBadge(request.userId, request.badgeId);
      if (!hasBadge) {
        return { success: false, error: 'Badge not found or already revoked' };
      }

      const revokedBadge = await this.achievementRepository.revokeBadge(
        request.userId,
        request.badgeId,
        request.reason,
      );

      if (!revokedBadge) {
        return { success: false, error: 'Badge not found or already revoked' };
      }

      const enrichedRevocation = this.enrichWithRevoker(revokedBadge, request.revokedBy);

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

      return { success: true, revocation: enrichedRevocation };
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

  private enrichWithRevoker(
    revokedBadge: RevokedBadgeRecord,
    fallbackRevokedBy: string,
  ): RevocationRecord {
    return {
      userBadgeId: revokedBadge.userBadgeId,
      userId: revokedBadge.userId,
      badgeId: revokedBadge.badgeId,
      badgeSlug: revokedBadge.badgeSlug,
      revokedAt: revokedBadge.revokedAt,
      revokedBy: fallbackRevokedBy,
      reason: revokedBadge.revocationReason,
    };
  }

  async reverseRevocation(
    userId: string,
    badgeId: string,
    reversedByAdmin: string,
    reason: string,
  ): Promise<RevocationResult> {
    const hasBadge = await this.achievementRepository.hasBadge(userId, badgeId);
    if (hasBadge) {
      return { success: false, error: 'Badge is not revoked' };
    }

    try {
      const restoredRecord = await this.achievementRepository.restoreBadge(
        userId,
        badgeId,
        reversedByAdmin,
      );

      if (!restoredRecord) {
        return { success: false, error: 'No revoked record found' };
      }

      const restoredAt = new Date();

      const revocation: RevocationRecord = {
        userBadgeId: restoredRecord.userBadgeId,
        userId,
        badgeId,
        badgeSlug: restoredRecord.badgeSlug,
        revokedAt: restoredRecord.revokedAt,
        revokedBy: DEFAULT_REVOKED_BY,
        reason: 'Original revocation',
        reversedAt: restoredAt,
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

      this.achievementDomainEventBus.emitBadgeRestored({
        userId,
        badgeId,
        badgeSlug: restoredRecord.badgeSlug,
        restoredAt,
        restoredBy: reversedByAdmin,
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
      revokedBy: this.resolveRevokedBy(record.revocationReason),
      reason: record.revocationReason ?? 'Unknown',
    }));
  }

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
      revokedBy: this.resolveRevokedBy(record.revocationReason),
      reason: record.revocationReason ?? 'Unknown',
    }));
  }

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
        revokedBy: this.resolveRevokedBy(record.revocationReason),
        reason: record.revocationReason ?? 'Unknown',
      }));

    return {
      totalRevocations,
      byReason,
      recentRevocations,
    };
  }

  private resolveRevokedBy(revocationReason: string | null): string {
    return revocationReason ?? DEFAULT_REVOKED_BY;
  }

  private validateRequest(request: RevocationRequest): string | null {
    if (!request.userId) {
      return 'userId is required';
    }

    if (!request.badgeId) {
      return 'badgeId is required';
    }

    const trimmedReason = request.reason?.trim() ?? '';
    if (trimmedReason.length === 0) {
      return 'reason is required';
    }

    if (trimmedReason.length < MIN_REASON_LENGTH) {
      return `reason must be at least ${MIN_REASON_LENGTH} characters`;
    }

    if (!request.revokedBy) {
      return 'revokedBy is required';
    }

    return null;
  }

  async canReawardBadge(userId: string, badgeId: string): Promise<boolean> {
    const hasBadge = await this.achievementRepository.hasBadge(userId, badgeId);
    return !hasBadge;
  }

  static getReasonCode(message: string): RevocationReasonCode | null {
    for (const [code, msg] of Object.entries(REVOCATION_REASON_MESSAGES)) {
      if (msg === message) {
        return code as RevocationReasonCode;
      }
    }
    return null;
  }

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
