import { Inject, Injectable } from '@nestjs/common';
import { passwordResetConfig } from '@/core/config';
import type { PasswordResetConfig as CorePasswordResetConfig } from '@/core/config';

/**
 * Auth-domain wrapper around the core password reset typed config.
 * Preserves the @Injectable() surface consumed by PasswordResetService.
 */
@Injectable()
export class PasswordResetConfig {
  constructor(
    @Inject(passwordResetConfig.KEY)
    private readonly config: CorePasswordResetConfig,
  ) {}

  get tokenTtlSeconds(): number {
    return this.config.tokenTtlSeconds;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }
}
