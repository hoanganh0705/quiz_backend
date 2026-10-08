/**
 * GraphQL server module.
 *
 * Schema is generated from the resolver classes, so the SDL is a build
 * artefact rather than a hand-maintained contract that can drift from the
 * implementation. The module is mounted at the server root, outside the REST
 * global prefix, because GraphQL is its own contract surface rather than a
 * versioned REST resource.
 */
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { JwtModule } from '@nestjs/jwt';
import { JwtService } from '@nestjs/jwt';
import type { ValidationRule } from 'graphql';

import { graphqlConfig, jwtConfig } from '@/core/config';
import { GraphQLErrorFormatter } from './graphql-error.formatter';
import { requiresAuthDirective } from './requires-auth.directive';
import { createGqlContextFactory } from './graphql-context.factory';
import { buildGraphqlRateLimitPlugin } from './graphql-rate-limit.plugin';
import {
  buildComplexityLimitRule,
  buildDepthLimitRule,
  DEFAULT_COMPLEXITY_ESTIMATORS,
} from './graphql-validation.rules';

const buildValidationRules = (config: ConfigType<typeof graphqlConfig>): ValidationRule[] => {
  const rules: ValidationRule[] = [];
  if (!config.depthLimitDisabled) {
    rules.push(buildDepthLimitRule({ maxDepth: config.depthLimit }) as ValidationRule);
  }
  if (!config.complexityLimitDisabled) {
    rules.push(
      buildComplexityLimitRule({
        maximumComplexity: config.complexityLimit,
        estimators: DEFAULT_COMPLEXITY_ESTIMATORS,
      }) as ValidationRule,
    );
  }
  return rules;
};

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    NestGraphQLModule.forRootAsync({
      driver: ApolloDriver,
      imports: [ConfigModule, JwtModule],
      inject: [graphqlConfig.KEY, ModuleRef, jwtConfig.KEY],
      useFactory: (
        config: ConfigType<typeof graphqlConfig>,
        moduleRef: ModuleRef,
        jwt: ConfigType<typeof jwtConfig>,
      ): ApolloDriverConfig => {
        const jwtService = moduleRef.get(JwtService, { strict: false });

        return {
          path: config.path,
          autoSchemaFile: config.autoSchemaFile,
          sortSchema: true,
          playground: config.playground,
          introspection: config.introspection,
          buildSchemaOptions: {
            directives: [requiresAuthDirective],
          },
          context: createGqlContextFactory(moduleRef, jwtService, jwt),
          formatError: (error) => new GraphQLErrorFormatter().formatError(error),
          validationRules: buildValidationRules(config),
          plugins: config.rateLimitDisabled
            ? []
            : [
                buildGraphqlRateLimitPlugin({
                  limit: config.rateLimit,
                  ttlMs: config.rateLimitTtlMs,
                }),
              ],
        };
      },
    }),
  ],
  providers: [GraphQLErrorFormatter],
  exports: [NestGraphQLModule, GraphQLErrorFormatter],
})
export class GraphQLModule {}
