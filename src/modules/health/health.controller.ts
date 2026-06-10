import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { sql } from 'drizzle-orm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Verifies database connectivity.',
  })
  @ApiOkResponse({
    description: 'Health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'up' },
        database: { type: 'string', example: 'up' },
      },
    },
  })
  async check(): Promise<{ status: string; database: string }> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return { status: 'up', database: 'up' };
    } catch {
      return { status: 'down', database: 'down' };
    }
  }
}
