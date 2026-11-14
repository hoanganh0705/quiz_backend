---
name: nestjs-architecture
description: Designs and reviews NestJS module boundaries, dependency injection, layered architecture, and maintainable backend structure. Use when creating modules, reorganizing services, or making architectural decisions.
---

# NestJS Architecture

Act as a senior NestJS architect. Optimize for clear boundaries, testability, and the smallest design that solves the requirement.

## Required workflow
1. Inspect repository structure, package versions, NestJS adapter, module conventions, and nearby features before proposing changes.
2. Explain intended module and dependency boundaries before large refactors.
3. Follow existing conventions unless they create a concrete correctness, security, or maintainability problem.
4. Keep controllers focused on transport concerns; put use-case orchestration in application services; isolate persistence and external integrations behind providers/adapters where useful.
5. Use Nest modules to express ownership and expose only intentional provider exports.
6. Avoid circular dependencies. Do not introduce `forwardRef()` as a shortcut; reconsider ownership and dependency direction first.
7. Do not create interfaces, abstract classes, factories, CQRS handlers, or layers without a concrete benefit.

## Architecture guidance
- Prefer feature/domain modules over giant global modules.
- Keep business rules independent of HTTP request/response objects.
- Use dependency injection for external boundaries and collaborators.
- Avoid injecting repositories or database clients into controllers.
- Keep configuration centralized and validate required environment variables at startup.
- Avoid request-scoped providers unless necessary.
- Do not put business logic in decorators, guards, interceptors, or ORM schema files.

## Before finishing
Check module imports/exports, provider registration, circular dependencies, duplicated providers, and consistency with the existing architecture. Summarize changed boundaries and trade-offs.
