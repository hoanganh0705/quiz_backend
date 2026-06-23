import { Inject, Injectable } from '@nestjs/common';
import { jwtConfig } from '@/core/config';
import type { JwtConfig } from '@/core/config';

/**
 * Auth-domain wrapper around the core JWT typed config.
 * Preserves the @Injectable() surface consumed by JwtTokenAdapter and SecurityService.
 */
@Injectable()
export class TokenConfig {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwt: JwtConfig,
  ) {}

  get access(): {
    secret: string;
    expiresInSeconds: number;
    issuer: string;
    audience: string;
  } {
    return {
      secret: this.jwt.accessSecret,
      expiresInSeconds: this.jwt.accessExpiresInSeconds,
      issuer: this.jwt.issuer.trim(),
      audience: this.jwt.audience.trim(),
    };
  }

  get refresh(): {
    secret: string;
    expiresInSeconds: number;
    issuer: string;
    audience: string;
  } {
    return {
      secret: this.jwt.refreshSecret,
      expiresInSeconds: this.jwt.refreshExpiresInSeconds,
      issuer: this.jwt.issuer.trim(),
      audience: this.jwt.audience.trim(),
    };
  }
}
