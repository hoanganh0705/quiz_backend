import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UserNotFoundError } from '@/modules/user/domain/errors/user-domain.errors';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { userProfiles, users } from '@/core/database/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { GetUserRankingHistoryQuery } from '../domain/types/get-user-ranking-history.query';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';
import type {
  PublicRankingHistoryResponseDto,
  RankingHistoryItemDto,
} from '../dto/response/leaderboard-response.dto';

@Injectable()
export class GetUserRankingHistoryQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @InjectPinoLogger(GetUserRankingHistoryQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(query: GetUserRankingHistoryQuery): Promise<PublicRankingHistoryResponseDto> {
    this.validateDateRange(query.from, query.to);

    const user = await this.db
      .select({
        userId: users.userId,
        username: users.username,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(eq(users.userId, query.targetUserId), isNull(users.deletedAt)))
      .limit(1);

    const targetUser = user[0];

    if (!targetUser) {
      this.logger.warn({
        event: 'get_public_ranking_history_user_not_found',
        targetUserId: query.targetUserId,
      });
      throw new UserNotFoundError();
    }

    this.logger.debug({
      event: 'get_public_ranking_history',
      targetUserId: query.targetUserId,
      period: query.period,
      from: query.from?.toISOString(),
      to: query.to?.toISOString(),
    });

    const items = await this.rankingRepository.getUserRankingHistory({
      userId: query.targetUserId,
      period: query.period,
      from: query.from,
      to: query.to,
    });

    return {
      userId: targetUser.userId,
      username: targetUser.username,
      history: items.map((item) => this.toDto(item.snapshotDate, item.rank)),
    };
  }

  private toDto(snapshotDate: string, rank: number): RankingHistoryItemDto {
    return {
      date: snapshotDate.slice(0, 10),
      rank,
    };
  }

  private validateDateRange(from?: Date, to?: Date): void {
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException('Invalid from date');
    }

    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid to date');
    }

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('The from date must be before or equal to the to date');
    }
  }
}
