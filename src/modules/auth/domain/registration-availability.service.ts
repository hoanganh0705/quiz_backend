import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import type { AvailabilityResult } from '../types/auth-result.types';

@Injectable()
export class RegistrationAvailabilityService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async checkEmailAvailability(email: string): Promise<AvailabilityResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const available = await this.userRepository.isEmailAvailable(normalizedEmail);
    return { available };
  }

  async checkUsernameAvailability(username: string): Promise<AvailabilityResult> {
    const normalizedUsername = username.trim().toLowerCase();
    const available = await this.userRepository.isUsernameAvailable(normalizedUsername);
    return { available };
  }
}
