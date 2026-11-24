---
name: clean-naming
description: Enforce domain-driven, semantic naming across the backend NestJS codebase. Strictly bans roadmap/phase-based variable names (e.g. isPhase4Live, phase5_), ticket IDs, sprint references, and meaningless placeholders in services, controllers, DTOs, entities, and migrations.
---

# Clean Naming & Semantic Backend Standards

Use this skill when authoring, reviewing, or refactoring code in the NestJS backend to ensure services, controllers, DTOs, database schemas, and event contracts express clear domain intent.

## Core Mandates

1. **Strictly Ban Process-Coupled Identifiers**:
   - Never name variables, functions, arguments, constants, DTOs, database columns, or endpoints after development phases, epics, sprint numbers, or tickets.
   - Banned: `isPhase4Live`, `Phase5RealtimeService`, `phase7-admin-users`, `sprint3Helper`, `tkt312Handler`.
   - Required: `isAttemptsLive`, `RealtimeNotificationService`, `admin-users`, `attemptHelper`.

2. **Domain-Driven Ubiquitous Language**:
   - Every class, method, and variable must reflect real domain models (`Quiz`, `Attempt`, `User`, `Role`, `AuditLog`, `Coin`).
   - Boolean variables must be prefixed with semantic auxiliary verbs (`is`, `has`, `can`, `should`, `are`) paired with the domain capability:
     - `isAttemptsLive` (not `isPhase4Live`)
     - `hasRole`
     - `canExecuteAction`

3. **NestJS Architecture Patterns**:
   - **Controllers:** Semantic REST resources (e.g., `@Controller('admin/users')`, not `@Controller('phase7/users')`).
   - **DTOs:** Express explicit payload purpose (e.g., `AdminCreateUserDto`, not `Phase7CreateUserDto`).
   - **Database Schemas:** Columns name real business attributes (`started_at`, not `phase4_started_at`).

4. **Self-Audit Verification**:
   Before finalizing backend code edits, run:
   ```bash
   grep -rnE "(isPhase[0-9]|phase[0-9]|Phase[0-9]|sprint[0-9]|tkt[-_0-9]|ticket[0-9])" \
     src/ --exclude-dir=node_modules --exclude-dir=dist
   ```
   Confirm zero process-coupled names were introduced.
