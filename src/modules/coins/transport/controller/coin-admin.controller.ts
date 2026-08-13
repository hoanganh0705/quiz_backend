/**
 * Admin coin controller — credit / clawback the wallet.
 *
 * Phase 6 (S-coin-spend) replaces the Phase 2 501 stub with the
 * real implementation. The route is guarded by
 * `@Permissions(Permission.COIN_ADMIN)` at the controller level
 * and the role check is enforced again at the service layer (so
 * internal jobs that call `CoinApplicationService.adminAdjust`
 * directly also fail closed).
 *
 *   POST /admin/coins/adjust
 *     body  : { userId, amount, reason, idempotencyKey? }
 *     201   : { transactionId, balance, createdAt, amount }
 *     403   : caller is not admin
 *     422   : `reason` is empty (COIN_ADMIN_ADJUSTMENT_REASON_REQUIRED)
 *
 * The amount is SIGNED — positive credits, negative claws back. The
 * `reason` field is REQUIRED and persisted to `metadata.reason` so
 * the ledger IS the audit trail. A caller-supplied
 * `idempotencyKey` (header OR body) makes the request safely
 * retryable.
 */
import { Controller, Post, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiAuthAction } from '@/common/swagger/swagger-decorators';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CoinApplicationService } from '../../application/coin.application.service';
import { CoinPresenter } from '../presenters/coin.presenter';
import { CoinAdminAdjustRequestDto } from '../../dto/request/coin-admin-adjust-request.dto';

const IDEMPOTENCY_HEADER = 'idempotency-key' as const;

@ApiTags('admin-coins')
@Controller('admin/coins')
@Permissions(Permission.COIN_ADMIN)
export class CoinAdminController {
  constructor(
    private readonly applicationService: CoinApplicationService,
    private readonly presenter: CoinPresenter,
  ) {}

  @Post('adjust')
  @ApiAuthAction({
    summary: "Adjust a user's coin balance (admin)",
    description:
      'Creates an `ADMIN_ADJUSTMENT` ledger entry that may be positive (grant) or negative (clawback). The ledger IS the audit trail; `metadata.reason` is required and persisted. The amount is signed; positive credits, negative debits. Idempotent via the `Idempotency-Key` header or the body field.',
    operationId: 'adminAdjustCoins',
  })
  @HttpCode(HttpStatus.CREATED)
  async adminAdjustCoins(
    @CurrentUser() admin: JwtPayload,
    @Body() body: CoinAdminAdjustRequestDto,
    @Headers(IDEMPOTENCY_HEADER) idempotencyHeader?: string,
  ): Promise<unknown> {
    const merged: CoinAdminAdjustRequestDto = {
      ...body,
      idempotencyKey: body.idempotencyKey ?? idempotencyHeader ?? undefined,
    };
    const result = await this.applicationService.adminAdjust(admin.sub, merged);
    return this.presenter.spendResult(result);
  }
}
