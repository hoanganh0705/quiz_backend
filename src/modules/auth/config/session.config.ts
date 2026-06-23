import { Inject, Injectable } from '@nestjs/common';
import { sessionsConfig } from '@/core/config';
import type { SessionsConfig } from '@/core/config';
import { securityConfig } from '@/core/config';
import type { SecurityConfig as CoreSecurityConfig } from '@/core/config';
import { serverConfig } from '@/core/config';
import type { ServerConfig as CoreServerConfig } from '@/core/config';

/**
 * Auth-domain wrapper around the core sessions and security typed configs.
 * Preserves the @Injectable() surface consumed by SessionService, SecurityService,
 * and AuthCookieService.
 */
@Injectable()
export class SessionConfig {
  constructor(
    @Inject(sessionsConfig.KEY)
    private readonly sessions: SessionsConfig,
    @Inject(securityConfig.KEY)
    private readonly security: CoreSecurityConfig,
    @Inject(serverConfig.KEY)
    private readonly server: CoreServerConfig,
  ) {}

  get refreshTokenCookieMaxAgeMs(): number {
    return this.sessions.refreshTokenCookieMaxAgeMs;
  }

  get refreshSessionTtlMs(): number {
    return Math.min(
      this.sessions.refreshTokenCookieMaxAgeMs,
      this.sessions.refreshExpiresInSeconds * 1_000,
    );
  }

  get maxActiveSessionsPerUser(): number {
    return this.sessions.maxActiveSessionsPerUser;
  }

  get refreshReuseGraceWindowMs(): number {
    return this.sessions.refreshTokenReuseGraceWindowSeconds * 1_000;
  }

  get refreshReuseGraceWindowSeconds(): number {
    return this.sessions.refreshTokenReuseGraceWindowSeconds;
  }

  get enforceDeviceBinding(): boolean {
    return this.security.sessionBindingStrict;
  }

  get environment(): { isProduction: boolean } {
    return {
      isProduction: this.server.nodeEnv === 'production',
    };
  }
}
