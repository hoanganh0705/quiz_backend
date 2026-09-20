import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  COMMENT_REPOSITORY_PORT,
  type CommentRepositoryPort,
} from '../../domain/ports/comment-repository.port';

@Injectable()
export class CommentCounterReconcilerService {
  constructor(
    @Inject(COMMENT_REPOSITORY_PORT)
    private readonly repo: CommentRepositoryPort,
    @InjectPinoLogger(CommentCounterReconcilerService.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron('30 3 * * *')
  async reconcileCommentCounters(): Promise<void> {
    this.logger.info({ event: 'comment_counts_reconcile_start' });
    try {
      const result = await this.repo.reconcileCounters();
      this.logger.info({
        event: 'comment_counts_reconcile_complete',
        repliesUpdated: result.replies,
      });
    } catch (error) {
      this.logger.error({
        event: 'comment_counts_reconcile_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
