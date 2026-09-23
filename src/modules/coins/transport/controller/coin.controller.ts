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
import { IDEMPOTENCY_KEY_MAX_LENGTH } from '../../coin.constants';

const IDEMPOTENCY_HEADER = 'idempotency-key' as const;
const SPEND_THROTTLE = { default: { limit: 30, ttl: 60_000 } } as const;

@ApiTags('coins')
@Controller()
export class CoinController {
  constructor(
    private readonly applicationService: CoinApplicationService,
    private readonly presenter: CoinPresenter,
  ) {}

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

  @Post('coins/tip')
  @Throttle(SPEND_THROTTLE)
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
  @Throttle(SPEND_THROTTLE)
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
  @Throttle(SPEND_THROTTLE)
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

  private resolveIdempotencyKey(
    supplied: string | undefined,
    userId: string,
    category: 'tip' | 'flair' | 'suppress',
  ): string {
    if (supplied && supplied.length > 0 && supplied.length <= IDEMPOTENCY_KEY_MAX_LENGTH) {
      return `coin:${userId}:${category}:${supplied}`;
    }
    return `coin:${userId}:${category}:auto:${cryptoRandomUuid()}`;
  }
}

function cryptoRandomUuid(): string {
  return (
    (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  );
}
