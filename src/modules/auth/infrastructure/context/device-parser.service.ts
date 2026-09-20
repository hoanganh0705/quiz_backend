import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import UAParserImport from 'ua-parser-js';
import type { IResult } from 'ua-parser-js';
import type { SessionDeviceType } from '../../types/auth-context.types';

type ParsedDeviceInfo = {
  browser: string | null;
  os: string | null;
  deviceType: SessionDeviceType;
};

type UAParserCtor = new (ua?: string) => {
  getResult(): IResult;
};

@Injectable()
export class DeviceParserService {
  constructor(@InjectPinoLogger(DeviceParserService.name) private readonly logger: PinoLogger) {}

  parseUserAgent(userAgent: string | null): ParsedDeviceInfo {
    if (!userAgent || userAgent.trim().length === 0) {
      return {
        browser: null,
        os: null,
        deviceType: 'unknown',
      };
    }

    // ua-parser-js has ESM/CJS interop quirks; this cast keeps a stable constructor type boundary.
    const UAParser = UAParserImport as unknown as UAParserCtor;

    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    const browser =
      typeof result.browser?.name === 'string'
        ? result.browser.name.trim().toLowerCase().replace(/\s+/g, '_')
        : null;

    const os = typeof result.os?.name === 'string' ? result.os.name.trim().toLowerCase() : null;

    let deviceType: SessionDeviceType = 'desktop';

    if (result.device?.type === 'mobile') {
      deviceType = 'mobile';
    } else if (result.device?.type === 'tablet') {
      deviceType = 'tablet';
    } else if (!result.device?.type) {
      deviceType = 'desktop';
    } else {
      // ua-parser-js occasionally returns device types the SessionDeviceType
      // union does not enumerate (e.g. 'wearable', 'embedded', 'xr', 'console').
      // Downgrade to 'unknown' so downstream session-binding logic treats the
      // session as "cannot compare" (see SecurityService.isSameSessionContext),
      // and emit a debug-level breadcrumb so a future contribution can decide
      // whether to widen the union.
      this.logger.debug({
        event: 'auth_device_parser_unknown_device_type',
        deviceType: result.device.type,
      });
      deviceType = 'unknown';
    }

    return {
      browser,
      os,
      deviceType,
    };
  }
}
