import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { oauthAccounts, users } from '@/core/database/schema';
import type { OAuthAccountRepositoryPort } from '../../domain/oauth/ports/oauth-account-repository.port';
import type { OAuthAccountRecord, OAuthProvider } from '../../domain/oauth/oauth.types';
import type { OutboxPort } from '../../domain/ports/outbox.port';
import { OUTBOX_PORT } from '../../domain/ports/outbox.port';
import { ID_GENERATOR, type IdGeneratorPort } from '@/common/utils/id-generator';

const OAUTH_NO_PASSWORD_HASH = '__OAUTH_NO_PASSWORD__';

@Injectable()
export class OAuthAccountRepository implements OAuthAccountRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGeneratorPort,
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
      .where(eq(oauthAccounts.providerUserId, providerUserId))
      .limit(1);

    if (!row || row.provider !== provider) {
      return null;
    }

    return row as OAuthAccountRecord;
  }

  async createOAuthUserWithLink(params: {
    provider: OAuthProvider;
    providerUserId: string;
    email: string;
    username: string;
  }): Promise<{
    userId: string;
    username: string;
    email: string;
    role: 'admin' | 'moderator' | 'user';
    oauthAccountId: string;
  }> {
    const preGeneratedUserId = this.idGenerator.generate();
    const nowIso = new Date().toISOString();

    const result = await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(users)
        .values({
          userId: preGeneratedUserId,
          email: params.email.toLowerCase(),
          username: params.username,
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
            username: params.username,
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
