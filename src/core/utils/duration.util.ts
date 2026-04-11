export function parseDurationToSeconds(rawValue: string, configKey: string): number {
  const trimmedValue = rawValue.trim().toLowerCase();
  const matchedValue = trimmedValue.match(/^(\d+)([smhd])?$/);
  if (!matchedValue) {
    throw new Error(
      `${configKey} has invalid format. Expected number or number with one of: s, m, h, d`,
    );
  }

  const amount = Number(matchedValue[1]);
  const unit = matchedValue[2] ?? 's';

  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
      return amount * 60 * 60 * 24;
    default:
      throw new Error(`${configKey} has unsupported unit`);
  }
}
