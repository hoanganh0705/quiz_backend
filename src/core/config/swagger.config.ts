/**
 * Swagger configuration.
 * Provides typed access to Swagger/OpenAPI documentation environment variables.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const swaggerConfig = registerAs('swagger', () => ({
  enabled: process.env.SWAGGER_ENABLED === 'true',
}));

export type SwaggerConfig = ConfigType<typeof swaggerConfig>;
