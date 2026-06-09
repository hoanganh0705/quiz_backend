import { Injectable } from '@nestjs/common';
import type { SessionRequestContext } from '../../types/auth-context.types';
import type { LoginResult } from '../../types/auth-result.types';
import type { OAuthProvider } from './oauth.types';
import { OAuthIdentityResolver } from './oauth-identity-resolver';
import { OAuthAccountLinker } from './oauth-account-linker';
import { OAuthSessionIssuer } from './oauth-session-issuer';
import { OAuthEventService } from './oauth-event.service';
import { OAuthAccountLinkingRequiredError } from './errors';
import { RateLimitExceededError } from '../errors';
import { OAuthAuthenticationPayload } from './ports/oauth-provider.port';

export type OAuthLoginCommand = {
  provider: OAuthProvider;
  authentication: OAuthAuthenticationPayload;
};

type RateLimitedOperation<T> = () => Promise<T>;
/**
 * OAuthLoginService — thin orchestrator.
 *
 * Composes four focused services:
 *   OAuthIdentityResolver  → authenticate + verify email
 *   OAuthAccountLinker    → find/create OAuth link
 *   OAuthSessionIssuer    → create session + tokens
 *   OAuthEventService     → emit domain + integration events
 *
 * This service's only responsibility is orchestration and error mapping.
 * All other concerns live in the four dedicated services above.
 */
@Injectable()
export class OAuthLoginService {
  constructor(
    private readonly identityResolver: OAuthIdentityResolver,
    private readonly accountLinker: OAuthAccountLinker,
    private readonly sessionIssuer: OAuthSessionIssuer,
    private readonly events: OAuthEventService,
  ) {}

  private async runWithRateLimitFailureEvent<T>(
    provider: OAuthProvider,
    operation: RateLimitedOperation<T>,
    userId?: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof RateLimitExceededError) {
        await this.events.emitLoginFailed({
          provider,
          reason: 'rate_limit_exceeded',
          userId,
        });
      }
      throw error;
    }
  }

  async login(command: OAuthLoginCommand, context: SessionRequestContext): Promise<LoginResult> {
    await this.runWithRateLimitFailureEvent(command.provider, () =>
      this.identityResolver.enforceRateLimit(context),
    );

    // 2. Authenticate + enforce email verification
    const claims = await this.identityResolver.resolve(command.provider, command.authentication);

    // 3. Check for existing OAuth link (known user)
    const existingUser = await this.accountLinker.findExistingLink(
      command.provider,
      claims.providerUserId,
    );

    if (existingUser) {
      await this.runWithRateLimitFailureEvent(
        command.provider,
        () => this.identityResolver.enforceRateLimit(context, existingUser.userId),
        existingUser.userId,
      );

      const result = await this.sessionIssuer.issue(existingUser, context, command.provider);
      this.events.publishLoginSuccess({ userId: existingUser.userId, provider: command.provider });
      void this.events.scheduleLoginIntegrationEvent(existingUser.userId, command.provider);
      return result;
    }

    // 4. No existing link — check for a verified user with this email
    const linkableUser = await this.accountLinker.findLinkableUserByEmail(claims.email);

    if (linkableUser) {
      if (!linkableUser.isVerified) {
        // Unverified existing user — require explicit confirmation; no writes occur
        throw new OAuthAccountLinkingRequiredError();
      }

      // Verified existing user → auto-link
      await this.accountLinker.autoLink({
        userId: linkableUser.userId,
        provider: command.provider,
        providerUserId: claims.providerUserId,
      });

      this.events.publishAccountLinked({
        userId: linkableUser.userId,
        provider: command.provider,
        providerUserId: claims.providerUserId,
      });

      const result = await this.sessionIssuer.issue(linkableUser, context, command.provider);
      this.events.publishLoginSuccess({ userId: linkableUser.userId, provider: command.provider });
      void this.events.scheduleLoginIntegrationEvent(linkableUser.userId, command.provider);
      return result;
    }

    // 5. Brand-new user → create account with OAuth link
    const newUser = await this.accountLinker.createUserWithLink({
      provider: command.provider,
      providerUserId: claims.providerUserId,
      email: claims.email,
    });

    this.events.publishAccountCreated({
      userId: newUser.userId,
      provider: command.provider,
      providerUserId: claims.providerUserId,
      username: newUser.username,
    });

    const result = await this.sessionIssuer.issue(newUser, context, command.provider);
    this.events.publishLoginSuccess({ userId: newUser.userId, provider: command.provider });
    void this.events.scheduleLoginIntegrationEvent(newUser.userId, command.provider);
    return result;
  }
}
