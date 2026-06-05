import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { oauthAccounts, users } from '@/core/database/schema';
import type { OAuthAccountRepositoryPort } from '../../domain/oauth/ports/oauth-account-repository.port';
import { deriveOAuthUsername } from '../../domain/oauth/utils/derive-oauth-username';
import type { OAuthAccountRecord, OAuthProvider } from '../../domain/oauth/oauth.types';
import type { OutboxPort } from '../../domain/ports/outbox.port';
import { OUTBOX_PORT } from '../../domain/ports/outbox.port';

const OAUTH_NO_PASSWORD_HASH = '__OAUTH_NO_PASSWORD__';

@Injectable()
export class OAuthAccountRepository implements OAuthAccountRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
  ) {}

  async findByProviderAndProviderUserId(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccountRecord | null> {
    const [row] = await this.db
      .select({
        oauthAccountId: oauthAccounts.oauthAccountId,
        userId: oauthAccounts.userId,
        provider: oauthAccounts.provider,
        providerUserId: oauthAccounts.providerUserId,
        createdAt: oauthAccounts.createdAt,
      })
      .from(oauthAccounts)
      .where(
        and(eq(oauthAccounts.providerUserId, providerUserId), eq(oauthAccounts.provider, provider)),
      )
      .limit(1);

    return (row as OAuthAccountRecord) ?? null;
  }

  async findByUserIdAndProvider(
    userId: string,
    provider: OAuthProvider,
  ): Promise<OAuthAccountRecord | null> {
    const [row] = await this.db
      .select({
        oauthAccountId: oauthAccounts.oauthAccountId,
        userId: oauthAccounts.userId,
        provider: oauthAccounts.provider,
        providerUserId: oauthAccounts.providerUserId,
        createdAt: oauthAccounts.createdAt,
      })
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)))
      .limit(1);

    return (row as OAuthAccountRecord) ?? null;
  }

  async createOAuthUserWithLink(params: {
    provider: OAuthProvider;
    providerUserId: string;
    email: string;
  }): Promise<{
    userId: string;
    username: string;
    email: string;
    role: 'admin' | 'moderator' | 'user';
    oauthAccountId: string;
  }> {
    const preGeneratedUserId = crypto.randomUUID();
    const username = deriveOAuthUsername(params.email, preGeneratedUserId);
    const nowIso = new Date().toISOString();

    const result = await this.db.transaction(async (tx) => {
      // Single deterministic insert — no retry loop, no savepoints
      const [inserted] = await tx
        .insert(users)
        .values({
          userId: preGeneratedUserId,
          email: params.email.toLowerCase(),
          username,
          passwordHash: OAUTH_NO_PASSWORD_HASH,
          isVerified: true,
        })
        .returning({ userId: users.userId, username: users.username });

      const [oauthAccount] = await tx
        .insert(oauthAccounts)
        .values({
          userId: preGeneratedUserId,
          provider: params.provider,
          providerUserId: params.providerUserId,
        })
        .returning({ oauthAccountId: oauthAccounts.oauthAccountId });

      await this.outbox.scheduleEvent(
        {
          aggregateType: 'oauth_account',
          eventType: 'oauth_account_created',
          payload: {
            userId: preGeneratedUserId,
            provider: params.provider,
            providerUserId: params.providerUserId,
            username,
          },
          nowIso,
        },
        tx,
      );

      return {
        userId: preGeneratedUserId,
        username: inserted.username,
        email: params.email.toLowerCase(),
        role: 'user' as const,
        oauthAccountId: oauthAccount.oauthAccountId,
      };
    });

    return result;
  }

  async linkOAuthAccountToExistingUser(params: {
    userId: string;
    provider: OAuthProvider;
    providerUserId: string;
  }): Promise<OAuthAccountRecord> {
    const nowIso = new Date().toISOString();

    const result = await this.db.transaction(async (tx) => {
      const record = await tx
        .insert(oauthAccounts)
        .values({
          userId: params.userId,
          provider: params.provider,
          providerUserId: params.providerUserId,
        })
        .returning({
          oauthAccountId: oauthAccounts.oauthAccountId,
          userId: oauthAccounts.userId,
          provider: oauthAccounts.provider,
          providerUserId: oauthAccounts.providerUserId,
          createdAt: oauthAccounts.createdAt,
        });

      await this.outbox.scheduleEvent(
        {
          aggregateType: 'oauth_account',
          eventType: 'oauth_account_linked',
          payload: {
            userId: params.userId,
            provider: params.provider,
            providerUserId: params.providerUserId,
          },
          nowIso,
        },
        tx,
      );

      return record;
    });

    return result as unknown as OAuthAccountRecord;
  }
}
