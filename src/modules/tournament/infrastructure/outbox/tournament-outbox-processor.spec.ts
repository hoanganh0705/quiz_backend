/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { TournamentOutboxProcessorService } from './tournament-outbox-processor.service';

function makeLogger(): any {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeDbHandle(dlqRows: ReadonlyArray<Record<string, unknown>>): any {
  const selectResult: any = {};
  const self: any = {
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
  };
  self.from.mockReturnValue(self);
  self.where.mockReturnValue(self);
  self.orderBy.mockReturnValue(self);
  self.limit.mockResolvedValue(dlqRows);

  selectResult.select = jest.fn().mockReturnValue(self);

  return selectResult;
}

function makeProcessor(
  dlqRows: ReadonlyArray<Record<string, unknown>>,
): TournamentOutboxProcessorService {
  return new TournamentOutboxProcessorService(
    makeDbHandle(dlqRows),
    { publish: jest.fn() } as any,
    { publish: jest.fn() } as any,
    { publishXpEarned: jest.fn() } as any,
    makeLogger(),
  );
}

describe('TournamentOutboxProcessorService (DLQ monitor)', () => {
  it('logs a DLQ alert when poisoned rows exist', async () => {
    const processor = makeProcessor([
      { eventId: 'e-1', attemptCount: 9 },
      { eventId: 'e-2', attemptCount: 11 },
    ]);

    await processor.monitorDeadLetterQueue();

    expect(processor['logger'].error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'tournament_outbox_dlq_alert',
        totalDlqEvents: 2,
      }),
    );
  });

  it('does NOT log when DLQ is empty', async () => {
    const processor = makeProcessor([]);

    await processor.monitorDeadLetterQueue();

    expect(processor['logger'].error).not.toHaveBeenCalled();
  });
});
