# Quiz Backend

NestJS backend for a quiz application. The API uses PostgreSQL through Drizzle ORM, Redis for auth/session support, JWT authentication, role/permission authorization, structured logging, validation pipes, and response/error formatting.

## Requirements

- Node.js compatible with NestJS 11
- pnpm
- Docker, if you want to use the local PostgreSQL and Redis scripts

## Setup

```bash
pnpm install
```

Create a local `.env` file with the values required by `src/core/config/env.validation.ts`. At minimum the app expects database, Redis, JWT, token expiry, and refresh cookie settings.

## Development

```bash
pnpm db:start
pnpm redis:start
pnpm db:migrate
pnpm start:dev
```

The API is served under the global prefix:

```text
/api/v1
```

## Useful Scripts

```bash
pnpm build
pnpm exec eslint "{src,test}/**/*.ts"
pnpm test
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:stop
pnpm redis:stop
```

## Project Layout

```text
src/
  app.module.ts
  main.ts
  common/        Shared framework utilities: public/current-user decorators, filters, guards, interceptors, utils.
  core/          Infrastructure: config validation, database, logger, Redis, low-level utilities.
  modules/       Feature modules: auth, user, category, tag, quiz, email.
  types/         Local ambient type declarations.
test/            E2E test configuration and specs.
```

Auth-specific RBAC and permission code lives in `src/modules/auth`. Shared request-level utilities that are not tied to a feature live in `src/common`.
