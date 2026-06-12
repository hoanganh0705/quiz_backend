/**
 * User Existence Adapter
 *
 * Implements UserExistencePort by delegating to UserRepositoryPort.
 * This adapter lives in infrastructure so the domain remains decoupled
 * from the User module.
 */

import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY_PORT } from '@/modules/user/domain/ports/user-repository.port';
import type { UserRepositoryPort } from '@/modules/user/domain/ports/user-repository.port';
import { type UserExistencePort, type UserPublicInfo } from '../../domain/ports/user-existence.port';

@Injectable()
export class UserExistenceAdapter implements UserExistencePort {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async exists(userId: string): Promise<boolean> {
    const user = await this.userRepository.findMeById(userId);
    return user !== null;
  }

  async findByUsernames(usernames: string[]): Promise<UserPublicInfo[]> {
    return this.userRepository.findByUsernames(usernames);
  }
}
