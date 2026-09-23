import { ApiOperation } from '@nestjs/swagger';

export const HomeSwaggerDecorators = {
  GetBundle: (): MethodDecorator => {
    return ApiOperation({
      summary: 'Get the home-page bundle',
      description:
        'Returns the read-only bundle of featured, trending, popular, ' +
        'categories, recent winners, and top players. The endpoint is ' +
        'public (no auth required); the bundle is best-effort and ' +
        'intended to be cached client-side + CDN for 60s.',
    });
  },
};
