# Backend Engineering Standards: Clean Code & Semantic Naming

## 1. Core Principle: Ubiquitous Domain Language in NestJS

Backend code defines the authoritative domain model, API contracts, database schemas, and event contracts. All identifiers must reflect the **business domain**, never project management artifacts, roadmap milestones, sprint numbers, or ticket IDs.

When authoring or reviewing NestJS services, controllers, DTOs, entities, and database migrations, code must describe **what business capability or rule is being executed**, independent of the timeline on which it was built.

---

## 2. Absolute Bans (Anti-Patterns)

The following naming patterns are strictly prohibited in the backend codebase:

### ❌ Banned Patterns

1. **Phase / Roadmap Milestone Naming**:
   - Variables/Fields: `isPhase4Live`, `isPhase7Ready`, `phase5Enabled`
   - Services / Classes: `Phase5RealtimeService`, `Phase7AuditService`
   - Controllers / Routes: `@Controller('phase4/attempts')`, `@Get('phase7-users')`
   - DTOs: `Phase7CreateUserDto`, `Phase4StartAttemptDto`
   - Database Columns / Tables: `phase4_started_at`, `phase7_audit_logs`
   - Event / Queue Names: `phase5.notification.broadcast`, `phase6.social.event`

2. **Ticket / Sprint / PR Identifiers in Identifiers**:
   - `tkt312Handler`, `sprint4Fix`, `pr102Workaround`, `issue42Validator`

3. **Vague / Disposable / Numbered Placeholders**:
   - `data2`, `itemNew`, `tempVal`, `doSomething`, `helper2`, `stuff`

---

## 3. Allowed vs. Banned Replacement Table

| Banned Anti-Pattern | Clean Domain Replacement | Layer / Context |
|---|---|---|
| `isPhase4Live` | `isAttemptsLive` or `areAttemptsEnabled` | Service / Feature gate |
| `Phase5RealtimeService` | `RealtimeNotificationService` | NestJS Application Service |
| `Phase7AuditController` | `AdminAuditController` | Transport / Controller |
| `Phase7CreateUserDto` | `AdminCreateUserDto` | Transport / DTO |
| `@Controller('api/v1/phase4/attempts')` | `@Controller('api/v1/attempts')` | REST API Route |
| `phase4_started_at` | `started_at` or `attempt_started_at` | Database Schema / Column |
| `'phase5:user-events'` | `'user-events'` or `'social-events'` | WebSocket / Redis / Kafka topic |

---

## 4. NestJS Architecture Naming Conventions

Follow these semantic naming patterns across all NestJS modules:

- **Modules:** `<domain>.module.ts` (e.g., `admin.module.ts`, `attempts.module.ts`)
- **Controllers:** `<domain>[-<role>].controller.ts` (e.g., `quiz-admin.controller.ts`, `attempts.controller.ts`)
- **Services:** `<domain>[-<action>].service.ts` (e.g., `admin-user.service.ts`, `auth-registration.service.ts`)
- **Ports / Interfaces:** `<domain>-<resource>.port.ts` (e.g., `user-repository.port.ts`)
- **Repositories:** `<domain>-<resource>.repository.ts` (e.g., `user-profile.repository.ts`)
- **DTOs:** `<domain>-<action>-<type>.dto.ts` (e.g., `admin-audit-search-query.dto.ts`, `admin-create-user.dto.ts`)
- **Guards:** `<purpose>.guard.ts` (e.g., `jwt.guard.ts`, `permissions.guard.ts`)
- **Entities / Schemas:** `<domain>.schema.ts` or `<entity>.entity.ts` (e.g., `schema.ts`, `user.entity.ts`)

---

## 5. Automated Audit & CI Verification

Run this check in CI or before merging backend pull requests:

```bash
grep -rnE "(isPhase[0-9]|phase[0-9]|Phase[0-9]|sprint[0-9]|tkt[-_0-9]|ticket[0-9])" \
  src/ --exclude-dir=node_modules --exclude-dir=dist
```

Ensure **0 matches** before approving PRs.
