import { ApiOperation } from '@nestjs/swagger';

import { HomeBundleResponseDto } from '../../dto/response/home-bundle-response.dto';

/**
 * `HomeSwaggerDecorators` — composable Swagger decorators for the
 * `GET /home` endpoint (Phase 4 / S-23).
 *
 * The endpoint is `Public()` and returns the home-page bundle.
 * The decorator is exposed as a method-style factory so the
 * controller can attach it via `@HomeSwaggerDecorators.GetBundle()`.
 */
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
  // Mark the response type so the presenter can reference it.
  _ResponseType: HomeBundleResponseDto,
};
