import { Injectable } from '@nestjs/common';
import UAParserImport from 'ua-parser-js';
import type { IResult } from 'ua-parser-js';
import { SessionDeviceType } from '../types/auth.types';

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
      deviceType = 'unknown';
    }

    return {
      browser,
      os,
      deviceType,
    };
  }
}
