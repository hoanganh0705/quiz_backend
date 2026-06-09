/**
 * User Search Adapter
 *
 * Implements UserSearchPort by delegating to UserRepository.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { USER_REPOSITORY_PORT } from '@/modules/user/domain/ports/user-repository.port';
import type { UserRepositoryPort } from '@/modules/user/domain/ports/user-repository.port';
import { UserSearchPort } from '../../domain/ports';
import { UserSearchResult } from '../../domain/types';

@Injectable()
export class UserSearchAdapter implements UserSearchPort {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @InjectPinoLogger(UserSearchAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  async searchUsers(
    query: string,
    limit: number,
    excludeUserId?: string,
  ): Promise<UserSearchResult[]> {
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

  async searchUsernameSuggestions(query: string, limit: number): Promise<string[]> {
    this.logger.debug({
      event: 'username_suggestions_requested',
      query,
      limit,
    });

    const results = await this.userRepository.searchUsernameSuggestions(query, limit);

    this.logger.debug({
      event: 'username_suggestions_completed',
      query,
      resultsCount: results.length,
    });

    return results;
  }
}
