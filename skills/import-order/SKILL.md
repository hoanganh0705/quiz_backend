---
name: import-order
description: Enforce deterministic top-of-file import ordering and numbered priority groups across the NestJS backend codebase. Bans mid-file imports, unorganized dependencies, and misplaced type/export declarations.
---

# Backend Import Ordering Standards

Use this skill whenever authoring, reviewing, or refactoring TypeScript code in the NestJS backend. This skill guides AI agents to scan files, identify misplaced or mid-file imports, and reorganize them into deterministic, numbered priority groups tailored for NestJS and Clean/Layered Architecture.

---

## 1. Core Mandates for the Agent

1. **Zero Mid-File Imports (Strict Top-of-File Mandate)**:
   - **All** static `import` statements must reside in a single, consolidated block at the very top of the file.
   - **Forbidden**:
     - Defining types, interfaces, or enums above imports.
     - Defining helper constants, functions, or DI symbols (`export const PORT = Symbol(...)`) above imports.
     - Interleaving re-exports (`export { ... } from '...'`) inside or between import statements.
     - In unit tests (`*.spec.ts`), declaring test helper types or mock stubs above imports.
   - **Permitted Before Imports**:
     - Polyfills: `import 'reflect-metadata';` on line 1 of entry files.
     - File-level license headers, JSDoc banners, or top-of-file comments.

2. **Deterministic Numbered Groups**:
   - Imports must be grouped strictly by their assigned group number (0 to 9).
   - Groups must appear in ascending numerical order.
   - Each group must be separated from adjacent groups by **exactly one blank line**.
   - No blank lines inside a single group.

3. **Internal Alphabetization**:
   - Within each group, sort imports alphabetically by module specifier.
   - Within import braces `{ ... }`, sort named imports alphabetically.

---

## 2. Numbered Priority Groups (Backend)

When organizing or reviewing imports, categorize every import into one of these 10 numbered groups:

| Order | Group Category | Path Patterns & Identification |
|---|---|---|
| **0** | **Polyfills & Bootstrapping** | `import 'reflect-metadata';`, `import 'dotenv/config';` (Line 1 of entry points) |
| **1** | **Node.js Built-ins** | Native Node modules using `node:` scheme (`node:path`, `node:crypto`, `node:events`, `node:stream`) |
| **2** | **NestJS Core Framework** | All `@nestjs/*` framework packages (`@nestjs/common`, `@nestjs/core`, `@nestjs/swagger`, `@nestjs/websockets`) |
| **3** | **Third-Party Libraries** | External npm dependencies (`drizzle-orm`, `ioredis`, `bullmq`, `rxjs`, `class-validator`, `jsonwebtoken`, `nestjs-pino`) |
| **4** | **Internal Core & Infrastructure** | Core foundation, database connection, telemetry (`@/core/database/*`, `@/core/config/*`, `@/core/observability/*`) |
| **5** | **Internal Common Layer** | Cross-cutting guards, interceptors, filters, pipes, utils (`@/common/guards/*`, `@/common/interceptors/*`, `@/common/utils/*`) |
| **6** | **Cross-Module Services** | External domain modules and application services (`@/modules/auth/*`, `@/modules/quiz/*`, `@/modules/user/*`) |
| **7** | **Module-Internal Layers (DDD)** | Layered architecture within the module (`../domain/*`, `../application/*`, `../infrastructure/*`, `../transport/*`, `../dto/*`) |
| **8** | **Relative Imports** | Sibling files and local constants (`./instance.constants`, `./instance.mapper`, `../errors`) |
| **9** | **Type-Only Imports** | Isolated type statements (`import type { ... }`). Preserves clean compile-time semantics and prevents DI runtime cycles. |

---

## 3. Agent Scanning & Audit Procedure

When tasked with scanning, checking, or fixing import order in a file or directory:

### Step 1: Scan for Mid-File Imports
Read the target file from top to bottom.
- Note line numbers of the first non-polyfill, non-comment code statement (such as `const`, `function`, `interface`, `type`, `class`, `enum`, `export const`).
- If any static `import` appears after that statement, the file violates the top-of-file rule.
- To scan multiple files quickly across the project, run:
  ```bash
  grep -rnE "^import " src/ --exclude-dir=node_modules
  ```
  Inspect files where imports appear deep in the file (e.g. line 20+).

### Step 2: Extract All Static Imports
- Extract every static import (`import ... from '...'`, `import '...'`, and `import type { ... } from '...'`), including multiline imports.
- Do NOT extract dynamic `await import(...)` expressions inside methods.

### Step 3: Classify & Sort into Numbered Groups
- Assign each extracted import to its numbered group (0 to 9) according to the table above.
- Sort imports within each group alphabetically by source path.
- Sort named bindings inside `{ ... }` alphabetically.

### Step 4: Reassemble the Top-of-File Block
1. Place polyfills (`import 'reflect-metadata';`) on line 1 if present.
2. Output each numbered group that contains imports in ascending order (1 through 9).
3. Insert **exactly one blank line** between different groups.
4. Insert **one blank line** after the final import group before the rest of the file begins.

### Step 5: Place Types, Enums, Constants, and Classes Below
- All `export type`, `export interface`, and `export enum` definitions belong **below** the import block.
- Port symbols (e.g. `export const QUIZ_REPOSITORY_PORT = Symbol(...)`) belong **below** the import block.
- Re-exports (e.g. `export { PlayerAlreadyJoinedError } from './errors';`) belong either at the bottom of the import block or in the module's index file, NEVER interleaved mid-file.
- In test files (`*.spec.ts`), all test helper types belong **below** all imports.

---

## 4. Canonical Examples & Patterns

### ❌ Violation Example 1: Types & Port Symbols Defined Above Imports
```ts
// ❌ BAD: Types and Symbol defined before imports
export interface CommentSnapshot {
  id: string;
  content: string;
}

export const COMMENT_REPOSITORY_PORT = Symbol('COMMENT_REPOSITORY_PORT');

import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { CommentView } from '../types';
```

```ts
// ✅ GOOD: Imports first, types and symbols below
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { CommentView } from '../types';

export interface CommentSnapshot {
  id: string;
  content: string;
}

export const COMMENT_REPOSITORY_PORT = Symbol('COMMENT_REPOSITORY_PORT');
```

---

### ❌ Violation Example 2: Re-exports Interleaved in the Middle of Imports
```ts
// ❌ BAD: export statement inside import block
import { Inject, Injectable } from '@nestjs/common';
import { InstanceNotFoundError } from './errors';

export { PlayerAlreadyJoinedError } from './errors';

import { InstanceCreatedEvent } from './events';
import { INSTANCE_NOTIFICATION_PORT } from '@/modules/notification/domain/ports';
```

```ts
// ✅ GOOD: Re-export placed below the complete import block
import { Inject, Injectable } from '@nestjs/common';

import { INSTANCE_NOTIFICATION_PORT } from '@/modules/notification/domain/ports';

import { InstanceCreatedEvent } from './events';
import { InstanceNotFoundError } from './errors';

export { PlayerAlreadyJoinedError } from './errors';
```

---

### Canonical Full Backend Layout
```ts
import 'reflect-metadata';

import { createHash } from "node:crypto";
import path from "node:path";

import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { eq } from "drizzle-orm";
import Redis from "ioredis";
import { firstValueFrom } from "rxjs";

import { DRIZZLE_DATABASE } from "@/core/database/database.module";
import { APP_CONFIG } from "@/core/config";

import { JwtAuthGuard } from "@/common/guards/jwt.guard";
import { ResponseFormatInterceptor } from "@/common/interceptors/response-format.interceptor";
import { decodeCursor } from "@/common/utils/cursor.util";

import { QUIZ_REPOSITORY_PORT } from "@/modules/quiz/domain/ports";
import { UserService } from "@/modules/user/application/user.service";

import { QuizInstanceRepositoryPort } from "../domain/ports/quiz-instance-repository.port";
import { InstanceCreatedEvent } from "../domain/events/instance.events";
import { InstanceNotFoundError } from "../domain/errors/instance.errors";

import { INSTANCE_TIMEOUT_MS } from "./instance.constants";
import { mapToInstanceDto } from "./instance.mapper";

import type { DrizzleDatabase } from "@/core/database/types";
import type { QuizInstanceEntity } from "../domain/entities/quiz-instance.entity";
import type { CreateInstanceDto } from "../dto/request/create-instance.dto";

// --- Service classes, interfaces, and logic follow below ---
```
