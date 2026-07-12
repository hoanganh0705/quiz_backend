import { writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from './seed-logger';

/**
 * A single record that should appear in the SEED_RECORD.md report.
 *
 * `kind` is the semantic category (e.g. "user", "badge", "quiz").
 * `id` is the human-readable identifier a tester would use to log in,
 * look up, or reference the row (e.g. username, email, slug).
 * `fields` is the table of headline details to render as columns.
 *
 * `details` is an optional richer payload rendered as a fenced code block
 * immediately under the row. It carries every other field available at
 * seed time (UUIDs, FK IDs, timestamps, JSON blobs, etc.) so the report
 * doubles as a complete reference for development, debugging, and API
 * testing — without forcing every field into the table view.
 *
 * `heading` overrides the markdown section heading (defaults to `kind`).
 */
export type SeedRecord = {
  kind: string;
  id: string;
  fields: Record<string, string>;
  /** Optional richer supplementary data rendered as a JSON block. */
  details?: Record<string, unknown>;
  /** Optional override for the markdown section heading (defaults to the kind). */
  heading?: string;
};

/**
 * Singleton-style recorder. Seed modules call `recorder.record(...)`
 * as they insert rows. After all seeds finish, `writeSeedRecord()`
 * flushes the buffer to a markdown file.
 *
 * Recording is best-effort: if a seed module forgets to call `record`,
 * the section simply won't appear in the report. It never throws.
 */
class SeedRecorder {
  private records: SeedRecord[] = [];

  record(record: SeedRecord): void {
    this.records.push(record);
  }

  /** Group records by their (heading || kind) for the report. */
  grouped(): Array<{ heading: string; records: SeedRecord[] }> {
    const byHeading = new Map<string, SeedRecord[]>();
    for (const record of this.records) {
      const heading = record.heading ?? record.kind;
      const list = byHeading.get(heading) ?? [];
      list.push(record);
      byHeading.set(heading, list);
    }
    return Array.from(byHeading.entries()).map(([heading, records]) => ({
      heading,
      records,
    }));
  }

  clear(): void {
    this.records = [];
  }
}

export const recorder = new SeedRecorder();

/**
 * Renders the buffered records to a markdown file and writes it to disk.
 *
 * Output location defaults to `<repo-root>/SEED_RECORD.md` so the file is
 * easy to find after a seed run. The file is overwritten on each run —
 * the report always reflects the most recent seed state.
 *
 * `outputDir` is required (no default that touches `process.cwd()`) so the
 * caller controls where the file lands — important because the seed script
 * can be invoked from different working directories.
 */
export const writeSeedRecord = (outputDir: string): string => {
  const grouped = recorder.grouped();

  if (grouped.length === 0) {
    logger.info('Seed record: nothing to write (no recorder.record() calls).');
    return '';
  }

  const lines: string[] = [];
  const generatedAt = new Date().toISOString();

  lines.push('# Seed Record');
  lines.push('');
  lines.push(
    `> Generated at **${generatedAt}**. This file is overwritten on every ` +
      `seed run. Do not edit by hand — re-run \`pnpm db:seed:all\` to refresh.`,
  );
  lines.push('');
  lines.push(
    'Use this file to find login credentials, identifiers, and a complete reference ' +
      'of every field persisted for each seeded row (IDs, foreign keys, timestamps, ' +
      'JSON blobs, and relationships).',
  );
  lines.push('');

  for (const { heading, records } of grouped) {
    lines.push(`## ${heading}`);
    lines.push('');

    // Build a markdown table from the union of keys across all records
    // in this section so that heterogeneous rows render cleanly.
    const keySet = new Set<string>();
    for (const record of records) {
      for (const key of Object.keys(record.fields)) {
        keySet.add(key);
      }
    }
    const keys = Array.from(keySet);

    lines.push(`| ${keys.join(' | ')} |`);
    lines.push(`| ${keys.map(() => '---').join(' | ')} |`);
    for (const record of records) {
      const cells = keys.map((key) => escapeMd(record.fields[key] ?? ''));
      lines.push(`| ${cells.join(' | ')} |`);
    }
    lines.push('');

    // Emit a "Full record" block per entity when richer details were
    // provided. This block carries every persisted field — IDs, FK IDs,
    // timestamps, JSON metadata, etc. — so the report is a complete
    // reference even though the headline table only carries the most
    // useful identifiers.
    const detailedRecords = records.filter((r) => r.details && Object.keys(r.details).length > 0);
    if (detailedRecords.length > 0) {
      lines.push('<details>');
      lines.push('<summary>Full record details (click to expand)</summary>');
      lines.push('');
      for (const record of detailedRecords) {
        const label =
          record.fields.username
            ?? record.fields.email
            ?? record.fields.slug
            ?? record.fields.title
            ?? record.fields.name
            ?? record.fields.quizSlug
            ?? record.id;
        lines.push(`**${label}**`);
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(record.details, null, 2));
        lines.push('```');
        lines.push('');
      }
      lines.push('</details>');
      lines.push('');
    }

    // For records that contain a `password` field, also emit a copy-pasteable
    // code block with the credential pair so testers don't have to scrape the
    // table. This is the headline ask of the seed record: "list the email,
    // password for login."
    const credRecords = records.filter(
      (r) => r.fields.email && r.fields.password && r.fields.username,
    );
    if (credRecords.length > 0) {
      lines.push('<details>');
      lines.push('<summary>Quick login snippets (click to expand)</summary>');
      lines.push('');
      for (const record of credRecords) {
        const username = record.fields.username;
        const email = record.fields.email;
        const password = record.fields.password;
        lines.push('```bash');
        lines.push(
          `# ${record.fields.displayName ?? username} (${record.fields.role ?? 'user'})`,
        );
        lines.push(`curl -X POST $BASE_URL/auth/login \\`);
        lines.push(`  -H 'Content-Type: application/json' \\`);
        lines.push(`  -d '{"emailOrUsername":"${email}","password":"${password}"}'`);
        lines.push('');
        lines.push(`# Or via username:`);
        lines.push(`curl -X POST $BASE_URL/auth/login \\`);
        lines.push(`  -H 'Content-Type: application/json' \\`);
        lines.push(`  -d '{"emailOrUsername":"${username}","password":"${password}"}'`);
        lines.push('```');
        lines.push('');
      }
      lines.push('</details>');
      lines.push('');
    }
  }

  const outputPath = join(outputDir, 'SEED_RECORD.md');
  writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  logger.info(`Seed record written to ${outputPath}`);
  return outputPath;
};

const escapeMd = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');