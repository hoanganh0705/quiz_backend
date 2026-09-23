import { ConfigType, registerAs } from '@nestjs/config';

/**
 * Feature flags for the Tournament module.
 *
 * Each flag is parsed from env via `parseBoolean(env, key, fallback)`. The
 * fallbacks below are the rollout defaults.
 */
const parseBoolean = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  throw new Error(`Tournament flag must be a boolean (true/false/1/0/yes/no), got '${raw}'`);
};

export const tournamentFlagsConfig = registerAs('tournamentFlags', () => {
  const tournamentBullMqDisable = parseBoolean(process.env['TOURNAMENT_BULLMQ_DISABLE'], true);
  return {
    /**
     * When true, the BullMQ publisher path in `BullmqTournamentEventBusService`
     * is skipped so tournament events flow exclusively through the
     * transactional outbox. This eliminates the historical triple-publish
     * (BullMQ + in-process + outbox) by demoting BullMQ to a DLQ replay
     * tool rather than a primary publisher.
     *
     * Default: `true`. Set `TOURNAMENT_BULLMQ_DISABLE=false` to re-enable
     * the duplicate path (only for emergency rollback — the outbox is the
     * canonical publisher).
     */
    tournamentBullMqDisable,
  };
});

export type TournamentFlagsConfig = ConfigType<typeof tournamentFlagsConfig>;
