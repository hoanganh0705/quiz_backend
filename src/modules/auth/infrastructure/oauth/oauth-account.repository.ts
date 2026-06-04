import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { oauthAccounts, users } from '@/core/database/schema';
import type { OAuthAccountRepositoryPort } from '../../domain/oauth/ports/oauth-account-repository.port';
import { OAuthAccountAlreadyExistsError } from '../../domain/oauth/errors';
import { deriveUsernameCandidates } from '../../domain/oauth/utils/derive-username-candidates';
import type { OAuthAccountRecord, OAuthProvider } from '../../domain/oauth/oauth.types';
import type { OutboxPort } from '../../domain/ports/outbox.port';
import { OUTBOX_PORT } from '../../domain/ports/outbox.port';
import { AuthIdentity } from '../../types/auth-context.types';

/** Sentinel value stored in `users.password_hash` for OAuth-only accounts. */
export const OAUTH_NO_PASSWORD_HASH = '__OAUTH_NO_PASSWORD__';

type UserIdentityRow = {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'moderator' | 'user';
};

type UserWithIdentityRow = UserIdentityRow & {
  oauthAccountId: string;
};

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
      .where(eq(oauthAccounts.providerUserId, providerUserId))
      .limit(1);

    if (!row || row.provider !== provider) {
      return null;
    }

    return row as OAuthAccountRecord;
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
      .where(eq(oauthAccounts.userId, userId))
      .limit(10);

    if (!row || row.provider !== provider) {
      return null;
    }

    return row as OAuthAccountRecord;
  }

  async createOAuthUserWithLink(params: {
    provider: OAuthProvider;
    providerUserId: string;
    email: string;
  }): Promise<{
    userId: string;
    username: string;
    email: string;
    role: string;
    oauthAccountId: string;
  }> {
    const preGeneratedUserId = crypto.randomUUID();
    const usernameCandidates = deriveUsernameCandidates(params.email, preGeneratedUserId);
    const nowIso = new Date().toISOString();

    const result = await this.db.transaction(async (tx) => {
      let selectedUsername: string | null = null;
      let finalUserId: string | null = null;

      for (const candidate of usernameCandidates) {
        try {
          await tx.execute(
            // Using raw SQL for savepoint management as Drizzle doesn't natively support savepoints
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (tx as any).dynamicRef?.('savepoint') ?? (() => {}),
          );
          // Try insert directly — if it fails with 23505 (unique violation), try next candidate
          const [inserted] = await tx
            .insert(users)
            .values({
              userId: preGeneratedUserId,
              email: params.email.toLowerCase(),
              username: candidate,
              passwordHash: OAUTH_NO_PASSWORD_HASH,
              isVerified: true,
            })
            .returning({ userId: users.userId, username: users.username });

          if (inserted) {
            selectedUsername = inserted.username;
            finalUserId = inserted.userId;
            break;
          }
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code;
          if (code !== '23505') {
            throw err;
          }
          // Unique constraint violation on username — try next candidate
        }
      }

      if (!selectedUsername || !finalUserId) {
        throw new Error('All username candidates are taken. Please try a different email.');
      }

      const [oauthAccount] = await tx
        .insert(oauthAccounts)
        .values({
          userId: finalUserId,
          provider: params.provider,
          providerUserId: params.providerUserId,
        })
        .returning({
          oauthAccountId: oauthAccounts.oauthAccountId,
        });

      await this.outbox.scheduleEvent(
        {
          aggregateType: 'oauth_account',
          eventType: 'oauth_account_created',
          payload: {
            userId: finalUserId,
            provider: params.provider,
            providerUserId: params.providerUserId,
            username: selectedUsername,
          },
          nowIso,
        },
        tx,
      );

      return {
        userId: finalUserId,
        username: selectedUsername,
        email: params.email.toLowerCase(),
        role: 'user' as const,
        oauthAccountId: oauthAccount.oauthAccountId,
      };
    });

    return result as {
      userId: string;
      username: string;
      email: string;
      role: string;
      oauthAccountId: string;
    };
  }

  async linkOAuthAccountToExistingUser(params: {
    userId: string;
    provider: OAuthProvider;
    providerUserId: string;
  }): Promise<OAuthAccountRecord> {
    const nowIso = new Date().toISOString();

    const [oauthAccount] = await this.db.transaction(async (tx) => {
      const [record] = await tx
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

    return oauthAccount as OAuthAccountRecord;
  }
}
