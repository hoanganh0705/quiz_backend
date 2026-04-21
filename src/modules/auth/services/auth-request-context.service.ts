import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SessionRequestContext } from '../types/auth.types';
import { DeviceParserService } from './device-parser.service';

@Injectable()
export class AuthRequestContextService {
  constructor(private readonly deviceParserService: DeviceParserService) {}

  extractIpAddress(request: Request): string | null {
    // NOTE: request.ips is derived from X-Forwarded-For and is only trustworthy when the
    // application is behind a trusted reverse proxy with Express "trust proxy" configured.
    if (Array.isArray(request.ips) && request.ips.length > 0) {
      return request.ips[0] ?? null;
    }

    return request.ip || null;
  }

  getSessionRequestContext(request: Request): SessionRequestContext {
    const userAgentHeader = request.headers['user-agent'];
    const userAgent = typeof userAgentHeader === 'string' ? userAgentHeader : null;
    const parsedDevice = this.deviceParserService.parseUserAgent(userAgent);

    return {
      ipAddress: this.extractIpAddress(request),
      userAgent,
      deviceBrowser: parsedDevice.browser,
      deviceOs: parsedDevice.os,
      deviceType: parsedDevice.deviceType,
    };
  }
}
