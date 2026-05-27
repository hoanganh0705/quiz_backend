import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UpdateMeDto } from '../../dto/request/update-me.dto';
import { UpdateMeSettingsDto } from '../../dto/request/update-me-settings.dto';
import type { UserMeRow } from './ports/user-repository.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { UserNotFoundError } from './errors';

@Injectable()
export class UserDomainService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @InjectPinoLogger(UserDomainService.name) private readonly logger: PinoLogger,
  ) {}

  async getMe(userId: string): Promise<UserMeRow> {
    const user = await this.userRepository.findMeById(userId);

    if (!user) {
      this.logger.warn({ event: 'user_get_me_not_found', userId });
      throw new UserNotFoundError();
    }

    return user;
  }

  async updateProfile(userId: string, payload: UpdateMeDto): Promise<UserMeRow> {
    const patch: {
      displayName?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};

    if ('displayName' in payload && payload.displayName !== undefined) {
      patch.displayName = payload.displayName?.trim() ?? null;
    }

    if ('bio' in payload) {
      patch.bio = payload.bio?.trim() ?? null;
    }

    if ('avatarUrl' in payload) {
      patch.avatarUrl = payload.avatarUrl?.trim() ?? null;
    }

    if (Object.keys(patch).length === 0) {
      return this.getMe(userId);
    }

    const nowIso = new Date().toISOString();
    const updated = await this.userRepository.updateProfile(userId, patch, nowIso);

    if (!updated) {
      this.logger.warn({ event: 'user_profile_update_not_found', userId });
      throw new UserNotFoundError();
    }

    this.logger.info({ event: 'user_profile_updated', userId });

    return updated;
  }

  async updateSettings(userId: string, payload: UpdateMeSettingsDto): Promise<UserMeRow> {
    const settings = payload.settings;

    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      throw new Error('settings must be a plain object');
    }

    const nowIso = new Date().toISOString();
    const updated = await this.userRepository.updateSettings(userId, settings, nowIso);

    if (!updated) {
      this.logger.warn({ event: 'user_settings_update_not_found', userId });
      throw new UserNotFoundError();
    }

    this.logger.info({ event: 'user_settings_updated', userId });

    return updated;
  }
}
