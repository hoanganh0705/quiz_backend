/**
 * User profile resolver.
 *
 * Thin transport adapter over `UserProfileBundleService` and
 * `SocialApplicationService`. It owns no privacy logic of its own: the
 * services already enforce block lists, relationship gating, and privacy
 * flags, and the only decision made here is whether the caller is anonymous,
 * which decides whether the already-computed private fields are handed back.
 *
 * The auth-gated fields resolve to `null` rather than raising, so one query
 * serves both a signed-in and a signed-out reader and the client does not have
 * to branch on a transport-level failure.
 */
import { Args, Context, Int, Parent, Query, Resolver, ResolveField } from '@nestjs/graphql';

import { Public } from '@/common/decorators/public.decorator';
import { UserProfileBundleService } from '@/modules/user/application/user-profile-bundle.service';
import { UserApplicationService } from '@/modules/user/application/user.application.service';
import { SocialApplicationService } from '@/modules/social/application/social-application.service';
import type { GqlContext } from '@/core/graphql/graphql-context';

import {
  presentActivity,
  presentFollowers,
  presentFollowing,
  presentUserProfile,
  type PresentedUserProfile,
} from './user.graphql.presenter';
import {
  SocialActivityConnectionGql,
  SocialConnectionConnectionGql,
  UserProfileGql,
} from './user.graphql.types';

/**
 * Page sizes for the connection fields. The social services default to 20 when
 * a limit is omitted, but the plan specifies wider defaults for the follower
 * rails, and an explicit ceiling keeps one query from asking for an unbounded
 * page.
 */
export const USER_CONNECTION_LIMITS = {
  DEFAULT_SOCIAL_LIMIT: 50,
  MAX_SOCIAL_LIMIT: 100,
  DEFAULT_ACTIVITY_LIMIT: 30,
  MAX_ACTIVITY_LIMIT: 100,
} as const;

const clampLimit = (requested: number | undefined, fallback: number, max: number): number =>
  Math.min(requested ?? fallback, max);

/**
 * Resolves the signed-in principal, or `null` when the request carried no
 * verified token. The context factory leaves `user` undefined rather than
 * throwing for an absent or invalid token, so a bad token degrades to an
 * anonymous read instead of a 401.
 */
const currentPrincipal = (ctx: GqlContext) => ctx.user ?? null;

/**
 * The profile has to be resolved from a handle before the bundle can be built,
 * because the bundle service is keyed by id.
 */
const readAcceptLanguage = (ctx: GqlContext): string | undefined => {
  const header = ctx.req?.headers?.['accept-language'];
  if (Array.isArray(header)) return header[0];
  return header;
};

@Resolver(() => UserProfileGql)
export class UserGraphqlResolver {
  constructor(
    private readonly profileBundleService: UserProfileBundleService,
    private readonly userApplicationService: UserApplicationService,
    private readonly socialApplicationService: SocialApplicationService,
  ) {}

  @Query(() => UserProfileGql, {
    name: 'userProfile',
    description: 'A public user profile identified by username.',
  })
  @Public()
  async userProfile(
    @Args('username', { type: () => String }) username: string,
    @Context() ctx: GqlContext,
  ): Promise<PresentedUserProfile> {
    const principal = currentPrincipal(ctx);
    const lookup = await this.userApplicationService.getUserByUsername(username);
    const isSelf = principal !== null && principal.sub === lookup.userId;

    const acceptLanguage = readAcceptLanguage(ctx);
    const bundle = isSelf
      ? await this.profileBundleService.getBundleForCurrentUser(lookup.userId, acceptLanguage)
      : await this.profileBundleService.getBundleForUser(
          lookup.userId,
          principal?.sub ?? lookup.userId,
          acceptLanguage,
        );

    // The auth-gated fields belong to the profile owner rather than to whoever
    // is reading, so they are revealed only on one's own profile. A third
    // party reading someone else's profile gets the summary and nothing else.
    return presentUserProfile(bundle, isSelf);
  }

  /**
   * Follower and following rails are the signed-in reader's view of the
   * profile owner's social graph, and the domain layer excludes blocked users
   * and enforces relationship visibility. Anonymous callers receive null rather
   * than a partial list, so the response shape never varies by caller.
   */
  @ResolveField('followers', () => SocialConnectionConnectionGql, {
    description: 'Requires authentication. Null for anonymous callers.',
  })
  async followers(
    @Parent() profile: PresentedUserProfile,
    @Context() ctx: GqlContext,
    @Args('first', {
      type: () => Int,
      nullable: true,
      defaultValue: USER_CONNECTION_LIMITS.DEFAULT_SOCIAL_LIMIT,
    })
    first?: number,
    @Args('after', { type: () => String, nullable: true }) after?: string,
  ): Promise<SocialConnectionConnectionGql | null> {
    const principal = currentPrincipal(ctx);
    if (!principal) return null;

    const result = await this.socialApplicationService.getFollowersOfUser(
      principal,
      profile.summary.userId,
      after ?? null,
      clampLimit(
        first,
        USER_CONNECTION_LIMITS.DEFAULT_SOCIAL_LIMIT,
        USER_CONNECTION_LIMITS.MAX_SOCIAL_LIMIT,
      ),
    );
    return presentFollowers(result);
  }

  @ResolveField('following', () => SocialConnectionConnectionGql, {
    description: 'Requires authentication. Null for anonymous callers.',
  })
  async following(
    @Parent() profile: PresentedUserProfile,
    @Context() ctx: GqlContext,
    @Args('first', {
      type: () => Int,
      nullable: true,
      defaultValue: USER_CONNECTION_LIMITS.DEFAULT_SOCIAL_LIMIT,
    })
    first?: number,
    @Args('after', { type: () => String, nullable: true }) after?: string,
  ): Promise<SocialConnectionConnectionGql | null> {
    const principal = currentPrincipal(ctx);
    if (!principal) return null;

    const result = await this.socialApplicationService.getFollowingOfUser(
      principal,
      profile.summary.userId,
      after ?? null,
      clampLimit(
        first,
        USER_CONNECTION_LIMITS.DEFAULT_SOCIAL_LIMIT,
        USER_CONNECTION_LIMITS.MAX_SOCIAL_LIMIT,
      ),
    );
    return presentFollowing(result);
  }

  /**
   * The social activity timeline is gated by the profile owner's `showActivity`
   * privacy flag, which the domain service enforces. A private timeline
   * surfaces as a domain failure, so it is translated into null to keep one
   * query usable against both public and private profiles.
   */
  @ResolveField('activity', () => SocialActivityConnectionGql, {
    nullable: true,
    description: 'Requires authentication. Null when the timeline is private.',
  })
  async activity(
    @Parent() profile: PresentedUserProfile,
    @Context() ctx: GqlContext,
    @Args('first', {
      type: () => Int,
      nullable: true,
      defaultValue: USER_CONNECTION_LIMITS.DEFAULT_ACTIVITY_LIMIT,
    })
    first?: number,
    @Args('after', { type: () => String, nullable: true }) after?: string,
  ): Promise<SocialActivityConnectionGql | null> {
    const principal = currentPrincipal(ctx);
    if (!principal) return null;

    try {
      const result = await this.socialApplicationService.getUserActivity(
        principal,
        profile.summary.userId,
        after ?? null,
        clampLimit(
          first,
          USER_CONNECTION_LIMITS.DEFAULT_ACTIVITY_LIMIT,
          USER_CONNECTION_LIMITS.MAX_ACTIVITY_LIMIT,
        ),
      );
      return presentActivity(result);
    } catch (error) {
      if (isPrivacyRestriction(error)) return null;
      throw error;
    }
  }
}

/**
 * Only the profile's own privacy flag produces this failure. Every other error
 * is a real fault and must keep propagating, otherwise a database outage would
 * be reported to the client as "this profile is private".
 */
const isPrivacyRestriction = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('is not public');
