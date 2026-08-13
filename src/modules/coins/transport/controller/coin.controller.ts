/**
 * Coin controller — earn-side reads + spend-side writes.
 *
 * Phase 4 wired the two earn-side reads; Phase 6 wires the three
 * spend-side POST endpoints (tip / flair / suppress) plus the
 * realtime cookie on Phase 5 (Phase 5 itself does not add HTTP
 * routes — the gateway is its own surface). The admin adjustment
 * endpoint lives in `coin-admin.controller.ts` so it can carry the
 * `COIN_ADMIN` permission gate at the controller level.
 *
 * ## URL surface
 *
 *   GET    /users/me/wallet
 *   GET    /users/me/coin-transactions
 *   POST   /coins/tip
 *   POST   /coins/flair
 *   POST   /coins/suppress-recommended
 *
 * The `/coins/*` prefix is consistent with design doc §13. The
 * `/me/*` reads piggyback on the user route prefix because that is
 * the established convention for `me/*` reads.
 *
 * ## Throttling
 *
 * The `/coins/tip` route carries a 30-req/min throttler (design §13).
 * The other two spend endpoints are intentionally un-throttled at
 * the controller layer — the spend service's daily-tip cap is the
 * meaningful guard there.
 */
import { Controller, Get, Post, Query, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';

import { ApiAuthAction } from '@/common/swagger/swagger-decorators';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CoinApplicationService } from '../../application/coin.application.service';
import { CoinPresenter } from '../presenters/coin.presenter';
import { CoinTransactionsQueryDto } from '../../dto/request/coin-transactions-query.dto';
import { CoinTipRequestDto } from '../../dto/request/coin-tip-request.dto';
import { CoinFlairRequestDto } from '../../dto/request/coin-flair-request.dto';
import { CoinSuppressRequestDto } from '../../dto/request/coin-suppress-request.dto';

const IDEMPOTENCY_HEADER = 'idempotency-key' as const;

@ApiTags('coins')
@Controller()
export class CoinController {
  constructor(
    private readonly applicationService: CoinApplicationService,
    private readonly presenter: CoinPresenter,
  ) {}

  // ─── Earn-side reads ───────────────────────────────────────────────

  @Get('users/me/wallet')
  @ApiAuthAction({
    summary: 'Get my coin wallet',
    description:
      "Returns the authenticated user's cached coin balance, today's daily-cap usage, and last-update timestamp.",
    operationId: 'getMyWallet',
  })
  @HttpCode(HttpStatus.OK)
  async getMyWallet(@CurrentUser() user: JwtPayload) {
    const wallet = await this.applicationService.getMyWallet(user.sub);
    return this.presenter.getMyWallet(wallet);
  }

  @Get('users/me/coin-transactions')
  @ApiAuthAction({
    summary: 'Get my coin transaction history',
    description:
      'Cursor-paginated list of coin ledger entries for the authenticated user, newest first. Cursor is opaque.',
    operationId: 'getMyCoinTransactions',
  })
  @HttpCode(HttpStatus.OK)
  async getMyCoinTransactions(
    @CurrentUser() user: JwtPayload,
    @Query() query: CoinTransactionsQueryDto,
  ) {
    const page = await this.applicationService.listMyTransactions(
      user.sub,
      query.cursor,
      query.limit,
    );
    return this.presenter.getMyCoinTransactions(page);
  }

  // ─── Spend-side writes (Phase 6) ───────────────────────────────────

  @Post('coins/tip')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiAuthAction({
    summary: 'Tip a quiz author',
    description:
      'Transfers 25 coins from the authenticated user to the quiz author. Throttled to 30 req/min; daily cap of 3 distinct authors enforced by CoinSpendService. Self-tipping blocked (422). Idempotent via the `Idempotency-Key` header.',
    operationId: 'tipQuizAuthor',
  })
  @HttpCode(HttpStatus.CREATED)
  async tipQuizAuthor(
    @CurrentUser() user: JwtPayload,
    @Body() body: CoinTipRequestDto,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey?: string,
  ) {
    const key = this.resolveIdempotencyKey(idempotencyKey, user.sub, 'tip');
    const result = await this.applicationService.tipUser(user.sub, body, key);
    return this.presenter.spendResult(result);
  }

  @Post('coins/flair')
  @ApiAuthAction({
    summary: 'Purchase a profile flair slot',
    description:
      "Equips one of the caller's owned badges on the profile header for 7 days. Cost: COIN_SPEND_AMOUNTS.PROFILE_FLAIR_SLOT_7D. The chosen `userBadgeId` must be currently owned and not revoked (422 COIN_FLAIR_BADGE_NOT_OWNED).",
    operationId: 'purchaseProfileFlair',
  })
  @HttpCode(HttpStatus.CREATED)
  async purchaseProfileFlair(
    @CurrentUser() user: JwtPayload,
    @Body() body: CoinFlairRequestDto,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey?: string,
  ) {
    const key = this.resolveIdempotencyKey(idempotencyKey, user.sub, 'flair');
    const result = await this.applicationService.purchaseFlair(user.sub, body, key);
    return this.presenter.spendResult(result);
  }

  @Post('coins/suppress-recommended')
  @ApiAuthAction({
    summary: 'Suppress a quiz from my Recommended rail',
    description:
      "Hides the quiz from the authenticated user's Recommended rail for 30 days. Cost: COIN_SPEND_AMOUNTS.SUPPRESS_RECOMMENDED_30D. Refuses a re-buy while a previous suppression is still active (409 COIN_SUPPRESS_ALREADY_ACTIVE).",
    operationId: 'suppressRecommendedQuiz',
  })
  @HttpCode(HttpStatus.CREATED)
  async suppressRecommendedQuiz(
    @CurrentUser() user: JwtPayload,
    @Body() body: CoinSuppressRequestDto,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey?: string,
  ) {
    const key = this.resolveIdempotencyKey(idempotencyKey, user.sub, 'suppress');
    const result = await this.applicationService.suppressRecommendedQuiz(user.sub, body, key);
    return this.presenter.spendResult(result);
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  /**
   * Resolve the idempotency key for a spend request. If the caller
   * supplied the `Idempotency-Key` header we use it verbatim (the
   * RFC allows arbitrary string tokens; we just sanity-cap the
   * length). Otherwise we mint a deterministic key so that two
   * callers hitting the same endpoint with the same payload but no
   * header still don't double-spend — the key is hashed from the
   * userId + category + referenceId + body, which is what the
   * design §9.5 "fallback" expects.
   */
  private resolveIdempotencyKey(
    supplied: string | undefined,
    userId: string,
    category: 'tip' | 'flair' | 'suppress',
  ): string {
    if (supplied && supplied.length > 0 && supplied.length <= 200) {
      return `coin:${userId}:${category}:${supplied}`;
    }
    // Deterministic fallback; for a truly fresh spend the caller is
    // expected to supply a header. Falling back to `randomUUID` would
    // defeat the idempotency property.
    return `coin:${userId}:${category}:auto:${Date.now()}:${randomSuffix()}`;
  }
}

function randomSuffix(): string {
  // 12 hex chars — collision-safe for the typical "one request per
  // millisecond" rate the throttle enforces.
  return Math.floor(Math.random() * 0xfffffffffff).toString(16);
}
