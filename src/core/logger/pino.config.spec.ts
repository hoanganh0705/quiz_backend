import { ConfigService } from '@nestjs/config';
import { createPinoHttpConfig } from './pino.config';

const makeConfigService = (overrides: Record<string, unknown> = {}): ConfigService =>
  ({
    get: (key: string, fallback?: unknown) =>
      key in overrides ? overrides[key] : (fallback as never),
  }) as unknown as ConfigService;

const getRedactPaths = (overrides: Record<string, unknown> = {}): string[] => {
  const config = createPinoHttpConfig(makeConfigService(overrides));
  const redact = config.pinoHttp.redact;
  if (!redact) {
    throw new Error('Expected redact configuration to be present');
  }
  if (Array.isArray(redact)) {
    return redact.flatMap((entry) => entry.paths);
  }
  return redact.paths;
};

describe('pino.config redaction paths', () => {
  it('scrubs request authorization header', () => {
    const paths = getRedactPaths();
    expect(paths).toEqual(expect.arrayContaining(['req.headers.authorization']));
  });

  it('scrubs request rawHeaders to prevent bearer-token leakage', () => {
    const paths = getRedactPaths();
    expect(paths).toEqual(expect.arrayContaining(['req.rawHeaders']));
  });

  it('scrubs request cookies map', () => {
    const paths = getRedactPaths();
    expect(paths).toEqual(expect.arrayContaining(['req.cookies.*']));
  });

  it('redacts responseTime.res.req.headers.authorization', () => {
    const paths = getRedactPaths();
    expect(paths).toEqual(expect.arrayContaining(['responseTime.res.req.headers.authorization']));
  });

  it('redacts responseTime.res.req.headers.cookie', () => {
    const paths = getRedactPaths();
    expect(paths).toEqual(expect.arrayContaining(['responseTime.res.req.headers.cookie']));
  });

  it('redacts responseTime.res.req.rawHeaders', () => {
    const paths = getRedactPaths();
    expect(paths).toEqual(expect.arrayContaining(['responseTime.res.req.rawHeaders']));
  });

  it('redacts responseTime.res.req.cookies wildcard', () => {
    const paths = getRedactPaths();
    expect(paths).toEqual(expect.arrayContaining(['responseTime.res.req.cookies.*']));
  });

  it('uses [REDACTED] as the censor token', () => {
    const config = createPinoHttpConfig(makeConfigService());
    const redact = config.pinoHttp.redact;
    if (Array.isArray(redact)) {
      throw new Error('Expected redact to be an object, not array');
    }
    expect(redact.censor).toBe('[REDACTED]');
    expect(redact.remove).toBe(false);
  });

  describe('autoLogging.ignore', () => {
    const callIgnore = (
      envOverrides: Record<string, unknown>,
      req: {
        url?: string;
        statusCode?: number;
      },
    ): boolean => {
      const config = createPinoHttpConfig(makeConfigService({ NODE_ENV: envOverrides.NODE_ENV }));
      const ignore = config.pinoHttp.autoLogging?.ignore;
      if (typeof ignore !== 'function') {
        throw new Error('Expected autoLogging.ignore to be a function');
      }
      return ignore({
        url: req.url ?? '',
        statusCode: req.statusCode ?? 200,
      });
    };

    it('ignores /health requests in production', () => {
      expect(callIgnore({ NODE_ENV: 'production' }, { url: '/health' })).toBe(true);
      expect(callIgnore({ NODE_ENV: 'production' }, { url: '/health/live' })).toBe(true);
    });

    it('ignores /ready requests in production', () => {
      expect(callIgnore({ NODE_ENV: 'production' }, { url: '/ready' })).toBe(true);
    });

    it('ignores /metrics 401 (auth-failed) requests in production', () => {
      expect(callIgnore({ NODE_ENV: 'production' }, { url: '/metrics', statusCode: 401 })).toBe(
        true,
      );
    });

    it('does not ignore /metrics 200 in production', () => {
      expect(callIgnore({ NODE_ENV: 'production' }, { url: '/metrics', statusCode: 200 })).toBe(
        false,
      );
    });

    it('does not ignore any path in development', () => {
      expect(callIgnore({ NODE_ENV: 'development' }, { url: '/health' })).toBe(false);
      expect(callIgnore({ NODE_ENV: 'development' }, { url: '/metrics', statusCode: 401 })).toBe(
        false,
      );
    });

    it('does not ignore /metrics in production when status is missing', () => {
      expect(callIgnore({ NODE_ENV: 'production' }, { url: '/metrics' })).toBe(false);
    });
  });

  describe('httpLogVolume metric', () => {
    it('exposes http_log_volume_total counter label keys when supplied', () => {
      const config = createPinoHttpConfig(makeConfigService(), {
        httpLogVolume: { labelKeys: ['path', 'method', 'status'] },
      });
      const metricsModule = config.pinoHttp as unknown as {
        httpLogVolume?: { labelKeys?: ReadonlyArray<string> };
      };
      expect(metricsModule.httpLogVolume).toBeDefined();
      expect(metricsModule.httpLogVolume?.labelKeys).toEqual(
        expect.arrayContaining(['path', 'method', 'status']),
      );
    });

    it('omits httpLogVolume when no metric options are supplied', () => {
      const config = createPinoHttpConfig(makeConfigService());
      const metricsModule = config.pinoHttp as unknown as {
        httpLogVolume?: unknown;
      };
      expect(metricsModule.httpLogVolume).toBeUndefined();
    });
  });
});
