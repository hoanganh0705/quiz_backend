import { Inject, Injectable } from '@nestjs/common';
import { AUTH_USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { normalizeEmail, normalizeUsername } from './utils/normalization.utils';
import type { AvailabilityResult } from '../types/auth-result.types';

@Injectable()
export class RegistrationAvailabilityService {
  constructor(
    @Inject(AUTH_USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async checkEmailAvailability(email: string): Promise<AvailabilityResult> {
    const normalizedEmail = normalizeEmail(email);
    const available = await this.userRepository.isEmailAvailable(normalizedEmail);
    return { available };
  }

  async checkUsernameAvailability(username: string): Promise<AvailabilityResult> {
    const normalizedUsername = normalizeUsername(username);
    const available = await this.userRepository.isUsernameAvailable(normalizedUsername);
    return { available };
  }
}
