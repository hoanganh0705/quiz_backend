---
name: nestjs-event-driven-outbox
description: Designs reliable event-driven workflows in NestJS, including domain events, integration events, transactional outbox, consumers, deduplication, and eventual consistency.
---

# Event-Driven Design and Transactional Outbox

Use events when independent components need to react to a meaningful fact or when asynchronous decoupling is valuable. Avoid event-driven complexity for simple in-process operations.

## Workflow
1. Distinguish domain events from integration events and commands.
2. Identify the transaction that changes business state and the event that must be published.
3. Define event schema, versioning, producer ownership, consumer ownership, delivery guarantees, and failure handling.
4. Decide whether a simple queue publish is sufficient or a transactional outbox is required.

## Reliability rules
- A database commit and external message publish are not one atomic operation by default.
- When losing an event is unacceptable, write an outbox record in the same DB transaction as the business change.
- Publish outbox records asynchronously and mark delivery state safely.
- Assume at-least-once delivery; consumers must be idempotent or deduplicate.
- Use stable event IDs and consumer inbox/deduplication records when necessary.
- Design for retries, poison messages, ordering requirements, and replay.
- Keep event payloads minimal and avoid secrets or unnecessary personal data.
- Version event contracts and plan compatibility for old/new producers and consumers.
- Do not promise global exactly-once processing without a concrete end-to-end design.

## Verification
Test crash windows, duplicate delivery, consumer retries, schema evolution, ordering assumptions, and outbox recovery.
