---
name: nestjs-feature-development
description: Implements complete NestJS backend features from requirements through modules, controllers, application services, persistence, DTOs, and tests. Use when building or extending API features.
---

# NestJS Feature Development

Implement features as coherent vertical slices, not disconnected generated files.

## Workflow
1. Clarify use case, actors, permissions, inputs, outputs, invariants, and failure cases. Ask one focused question if a critical requirement is missing.
2. Inspect neighboring features and reuse naming, folder layout, response format, error conventions, and dependency patterns.
3. Identify domain operations and persistence needs before writing the controller.
4. Plan the smallest set of files and dependencies.
5. Implement validation, controller, application service, persistence access, and tests.
6. Run relevant formatting, linting, type-checking, and tests. Report commands that could not be run.

## Rules
- Controllers handle HTTP routing, status codes, parameter extraction, and transport mapping only.
- Services orchestrate use cases and enforce application-level rules.
- Keep business invariants out of controllers.
- Use explicit DTOs for request and response contracts; never expose ORM rows blindly.
- Use typed return values and avoid `any`, unsafe casts, and non-null assertions unless justified.
- Handle not-found, conflict, forbidden, and validation cases deliberately.
- Preserve API compatibility unless breaking changes are explicitly permitted.
- Do not silently add dependencies or change package versions.
- Do not implement unrelated cleanup.

## Completion
Cover happy and failure paths, enforce authorization, make required writes atomic, and test observable behavior.
