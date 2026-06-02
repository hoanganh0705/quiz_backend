/**
 * User Search Adapter
 *
 * Implements UserSearchPort by delegating to UserRepository.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { USER_REPOSITORY_PORT } from '@/modules/user/domain/ports/user-repository.port';
import type { UserRepositoryPort, UserSearchResult as UserRepoSearchResult } from '@/modules/user/domain/ports/user-repository.port';
import { USER_SEARCH_PORT, type UserSearchPort } from '../ports/user-search.port';
import type { UserSearchResult } from '../types/social.types';

@Injectable()
export class UserSearchAdapter implements UserSearchPort {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @InjectPinoLogger(UserSearchAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  async searchUsers(query: string, limit: number, excludeUserId?: string): Promise<UserSearchResult[]> {
    this.logger.debug({
      event: 'user_search_requested',
      query,
      limit,
      excludeUserId,
    });

    const results = await this.userRepository.searchUsers(query, limit, excludeUserId);

    this.logger.debug({
      event: 'user_search_completed',
      query,
      resultsCount: results.length,
    });

    return results;
  }
}
