/**
 * Ranking Milestone Repository
 *
 * Owns ranking-milestone aggregate operations.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import { rankingMilestones } from '@/core/database/schema';
import type { RankingMilestoneRow } from '../../../domain/ports/ranking-repository.port';
import { RankingMilestone } from '../../../domain/types/ranking.types';

@Injectable()
export class RankingMilestoneRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    @InjectPinoLogger(RankingMilestoneRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  async createMilestone(params: {
    userId: string;
    milestone: RankingMilestone;
    rank: number;
    achievedAt: Date;
  }): Promise<RankingMilestoneRow> {
    const [result] = await this.db
      .insert(rankingMilestones)
      .values({
        userId: params.userId,
        milestone: params.milestone,
        rank: params.rank,
        achievedAt: params.achievedAt.toISOString(),
      })
      .onConflictDoNothing()
      .returning();

    if (result) {
      return result as RankingMilestoneRow;
    }

    const existing = await this.db.query.rankingMilestones.findFirst({
      where: and(
        eq(rankingMilestones.userId, params.userId),
        eq(rankingMilestones.milestone, params.milestone),
      ),
    });

    if (!existing) {
      throw new Error('Failed to persist ranking milestone');
    }

    return existing as RankingMilestoneRow;
  }

  async getUserMilestones(userId: string): Promise<RankingMilestoneRow[]> {
    const results = await this.db.query.rankingMilestones.findMany({
      where: eq(rankingMilestones.userId, userId),
      orderBy: [asc(rankingMilestones.achievedAt), asc(rankingMilestones.rank)],
    });

    return results as RankingMilestoneRow[];
  }

  async hasMilestone(params: { userId: string; milestone: RankingMilestone }): Promise<boolean> {
    const result = await this.db.query.rankingMilestones.findFirst({
      columns: { id: true },
      where: and(
        eq(rankingMilestones.userId, params.userId),
        eq(rankingMilestones.milestone, params.milestone),
      ),
    });

    return result !== undefined;
  }
}
