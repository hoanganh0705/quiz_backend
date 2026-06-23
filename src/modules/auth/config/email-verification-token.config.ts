import { Inject, Injectable } from '@nestjs/common';
import { emailVerificationConfig } from '@/core/config';
import type { EmailVerificationConfig as CoreEmailVerificationConfig } from '@/core/config';

/**
 * Auth-domain wrapper around the core email verification typed config.
 * Preserves the @Injectable() surface consumed by VerificationTokenService.
 */
@Injectable()
export class EmailVerificationConfig {
  constructor(
    @Inject(emailVerificationConfig.KEY)
    private readonly config: CoreEmailVerificationConfig,
  ) {}

  get tokenTtlSeconds(): number {
    return this.config.tokenTtlSeconds;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }
}
