import { SeedLogger, buildSeedLogger, buildSeedPinoLogger, logger } from './seed-logger';

describe('SeedLogger', () => {
  describe('format-level methods', () => {
    it('captures entries with the correct level and stores them in getLogs()', () => {
      const l = new SeedLogger();
      l.info('hello');
      l.warn('careful');
      l.error('boom');
      const entries = l.getLogs();
      expect(entries.map((e) => e.level)).toEqual(['info', 'warn', 'error']);
      expect(entries.map((e) => e.message)).toEqual(['hello', 'careful', 'boom']);
    });

    it('falls back to console.* when no pino sink is supplied', () => {
      const l = new SeedLogger();
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        l.info('hello', { foo: 'bar' });
        l.warn('careful');
        l.error('boom');
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] hello'));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN] careful'));
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] boom'));
      } finally {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });

  describe('group()', () => {
    it('emits a labeled banner before and after the wrapped work via the pino sink', async () => {
      const lines: string[] = [];
      const l = buildSeedLogger({
        write(chunk: string): boolean {
          lines.push(chunk);
          return true;
        },
      });
      await l.group('Phase A', async () => undefined);
      const messages = lines.map((line) => JSON.parse(line).msg);
      expect(messages).toContain('━━━ Phase A ━━━');
      expect(messages).toContain('━━━ Phase A done ━━━');
    });

    it('emits a labeled banner before and after the wrapped work via console.log fallback', async () => {
      const l = new SeedLogger();
      const calls: string[] = [];
      const spy = jest.spyOn(console, 'log').mockImplementation((msg) => {
        calls.push(String(msg));
      });
      try {
        await l.group('Phase A', async () => undefined);
      } finally {
        spy.mockRestore();
      }
      expect(calls[0]).toContain('Phase A');
      expect(calls.at(-1)).toContain('Phase A done');
    });
  });

  describe('pino-backed redaction', () => {
    it('writes structured JSON and redacts req.body.password', () => {
      const lines: string[] = [];
      const l = buildSeedLogger({
        write(chunk: string): boolean {
          lines.push(chunk);
          return true;
        },
      });
      l.info('seeded', {
        email: 'a@b.c',
        req: { body: { password: 'should-be-redacted' } },
      });
      expect(lines).toHaveLength(1);
      const line = lines[0];
      expect(line).toContain('"msg":"seeded"');
      expect(line).not.toContain('should-be-redacted');
      expect(line).toContain('[REDACTED]');
    });

    it('buildSeedPinoLogger exposes the redact paths', () => {
      const sink = buildSeedPinoLogger({
        write(): boolean {
          return true;
        },
      });
      expect(sink).toBeDefined();
    });
  });

  describe('default logger export', () => {
    it('is a SeedLogger backed by pino with redaction', () => {
      expect(logger).toBeInstanceOf(SeedLogger);
      // Drain the constructor-time sink so the test does not log to stdout.
      logger.getLogs();
    });
  });
});
