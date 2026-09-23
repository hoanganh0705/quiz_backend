import { Controller, Post, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';

import { ApiAuthAction } from '@/common/swagger/swagger-decorators';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CoinApplicationService } from '../../application/coin.application.service';
import { CoinPresenter } from '../presenters/coin.presenter';
import { CoinAdminAdjustRequestDto } from '../../dto/request/coin-admin-adjust-request.dto';
import type { CoinSpendResponseDto } from '../../dto/response/coin-spend-response.dto';

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
  ): Promise<ApiResponseEnvelope<CoinSpendResponseDto>> {
    const merged: CoinAdminAdjustRequestDto = {
      ...body,
      idempotencyKey: body.idempotencyKey ?? idempotencyHeader ?? undefined,
    };
    const result = await this.applicationService.adminAdjust(admin.sub, merged);
    return this.presenter.spendResult(result);
  }
}
