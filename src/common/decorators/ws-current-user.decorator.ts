import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedSocket } from '@/common/guards/ws-jwt.guard';
import type { JwtPayload } from '@/common/guards/jwt.guard';

export const WsCurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const client: AuthenticatedSocket = ctx.switchToWs().getClient();
    const user = client.user;

    if (!user) {
      return undefined;
    }

    if (!data) {
      return user;
    }

    return user[data];
  },
);
