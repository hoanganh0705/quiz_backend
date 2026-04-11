import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SessionRequestContext } from '../types/auth.types';
import { DeviceParserService } from './device-parser.service';

@Injectable()
export class AuthRequestContextService {
  constructor(private readonly deviceParserService: DeviceParserService) {}

  extractIpAddress(request: Request): string | null {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      const [firstIp] = forwardedFor.split(',');
      return firstIp?.trim() || null;
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor[0]?.trim() || null;
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
