import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { AuthRequestContext } from '../types/auth-http-context.types';

type RequestWithAuthContext = {
  authContext?: AuthRequestContext;
};

export const RequestContext = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithAuthContext>();

  if (!request.authContext) {
    throw new InternalServerErrorException('Request context is not initialized');
  }

  return request.authContext;
});
