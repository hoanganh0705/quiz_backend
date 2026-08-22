/**
 * Phase 5 #3 — admin audit log search controller.
 *
 * `GET /admin/audit/search`
 *
 * Query parameters: see `AdminAuditSearchQueryDto`. The
 * endpoint is restricted to administrators via the
 * `AUDIT_READ` permission.
 *
 * Wire shape: the standard `ApiResponse.page` envelope so
 * clients can use the existing pagination helpers.
 */
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResourceList } from '@/common/swagger/api-ok';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '@/common/responses/api-response';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { AdminAuditSearchService } from './application/admin-audit-search.service';
import { AdminAuditSearchQueryDto } from './dto/admin-audit-search-query.dto';
import { AdminAuditRowDto } from './dto/admin-audit-row.dto';

@Controller('admin/audit')
@ApiTags('admin')
export class AdminAuditController {
  constructor(private readonly search: AdminAuditSearchService) {}

  @Get('search')
  @Permissions(Permission.AUDIT_READ)
  @ApiOkResourceList(AdminAuditRowDto, 'offset', {
    description: 'Paginated audit log rows.',
  })
  async searchAudit(@Query() query: AdminAuditSearchQueryDto) {
    const { items, page, limit, total } = await this.search.search(query);
    return ApiResponse.page(items, {
      kind: 'offset',
      page,
      limit,
      total,
      hasMore: page * limit < total,
    });
  }
}