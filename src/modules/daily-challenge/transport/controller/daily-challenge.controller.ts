import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, OptionalCurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { DailyChallengeApplicationService } from '../../application/daily-challenge.application.service';
import { DailyChallengePresenter } from '../presenters/daily-challenge.presenter';
import {
  DailyChallengeAnswerQueryDto,
  DailyChallengeHistoryQueryDto,
  DailyChallengeLeaderboardQueryDto,
} from '../../dto/request/daily-challenge-queries.dto';
import {
  ApiDailyChallengeAnswer,
  ApiDailyChallengeHistory,
  ApiDailyChallengeLeaderboard,
  ApiDailyChallengeToday,
} from '../swagger/daily-challenge-swagger-decorators';

@ApiTags('daily-challenge')
@Controller('daily-challenge')
export class DailyChallengeController {
  constructor(
    private readonly service: DailyChallengeApplicationService,
    private readonly presenter: DailyChallengePresenter,
  ) {}

  /**
   * `GET /daily-challenge/today` — returns the day's snapshot.
   * The exact payload depends on the viewer's auth state:
   *   - unauthenticated → `status: 'pending'`, score/rank null.
   *   - authenticated, no attempt → `status: 'pending'`.
   *   - authenticated, completed → `status: 'completed'`, score/rank populated.
   *
   * The route is `@Public()` so deep-link previews from social/sharing
   * surfaces work without a session. We MUST use `OptionalCurrentUser`
   * (not `@Optional() @CurrentUser()`): the global `JwtGuard` returns
   * early on `@Public()` routes and never sets `request.user`, so the
   * strict `CurrentUser` decorator would throw 401 for every viewer
   * regardless of whether they authenticated. `OptionalCurrentUser`
   * returns `undefined` instead, which is the correct projection for a
   * public surface.
   */
  @Get('today')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Get today's daily challenge" })
  @ApiDailyChallengeToday()
  async getToday(@OptionalCurrentUser() user?: JwtPayload) {
    const items = await this.service.getToday(user?.sub ?? null);
    return this.presenter.getToday(items);
  }

  /**
   * `GET /daily-challenge/history` — viewer's completed daily-challenge
   * history, cursor-paginated.
   *
   * The route is `@Public()` so SSR/SEO surfaces can fetch a placeholder
   * payload without a session. Same caveat as `getToday`: the global
   * `JwtGuard` skips authentication on `@Public()` routes, so we read
   * the user through `OptionalCurrentUser` and return an empty page when
   * the viewer is unauthenticated (the service treats `userId: null`
   * as "no history to show").
   */
  @Get('history')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get the viewer’s completed daily-challenge history' })
  @ApiDailyChallengeHistory()
  async getHistory(
    @OptionalCurrentUser() user: JwtPayload | undefined,
    @Query() query: DailyChallengeHistoryQueryDto,
  ) {
    const payload = await this.service.getHistory(user?.sub ?? null, query);
    return this.presenter.getHistory(payload);
  }

  @Get('leaderboard')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get the daily-challenge leaderboard for the given period' })
  @ApiDailyChallengeLeaderboard()
  async getLeaderboard(@Query() query: DailyChallengeLeaderboardQueryDto) {
    const payload = await this.service.getLeaderboard(query);
    return this.presenter.getLeaderboard(payload);
  }

  @Post('answer')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit an answer for the current daily-challenge question' })
  @ApiDailyChallengeAnswer()
  async submitAnswer(
    @CurrentUser() user: JwtPayload,
    @Body() payload: DailyChallengeAnswerQueryDto,
  ) {
    const response = await this.service.submitAnswer(user.sub, payload);
    return this.presenter.submitAnswer(response);
  }
}
