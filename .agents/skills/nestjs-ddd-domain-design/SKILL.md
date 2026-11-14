---
name: nestjs-ddd-domain-design
description: Applies pragmatic domain-driven design to NestJS features, including aggregates, entities, value objects, domain services, domain events, and bounded contexts. Use when modeling complex business rules or separating domain logic from infrastructure.
---

# Pragmatic DDD for NestJS

Use DDD to clarify complex business rules, not to add ceremony to simple CRUD.

## Workflow
1. Read the business requirements and existing code before naming aggregates or bounded contexts.
2. Identify domain language, actors, invariants, lifecycle, and consistency boundaries.
3. Separate domain decisions from transport, persistence, and framework concerns only where that separation pays for itself.
4. Explain aggregate boundaries and which invariants must hold atomically.

## Modeling rules
- An entity has identity and lifecycle; a value object is defined by its values and should be immutable where practical.
- An aggregate is a consistency boundary, not merely a folder or a table.
- Enforce invariants through aggregate/application operations and database constraints where appropriate.
- Avoid loading or mutating multiple aggregates inside one giant service method without clear consistency reasoning.
- Do not create repositories for every table automatically; define persistence abstractions around meaningful aggregate/use-case needs.
- Keep NestJS decorators and Drizzle types out of the domain model when practical.
- Use domain events for meaningful business facts, not as a replacement for direct method calls everywhere.
- Do not introduce CQRS or event sourcing unless requirements justify their operational and conceptual cost.

## Output
Describe the domain terms, invariants, aggregate boundaries, and trade-offs. Keep the implementation proportional to domain complexity.
