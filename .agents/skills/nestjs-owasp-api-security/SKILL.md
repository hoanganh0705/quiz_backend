---
name: nestjs-owasp-api-security
description: Performs threat-aware security reviews of NestJS APIs using OWASP-style risk categories, including broken access control, injection, authentication flaws, SSRF, file upload risks, and sensitive data exposure.
---

# OWASP-Informed API Security Review

Use this skill for a focused threat review, not as a claim of formal certification or a substitute for penetration testing.

## Review workflow
1. Identify assets, trust boundaries, entry points, actors, and sensitive operations.
2. Trace authorization from route to resource-level data access.
3. Review validation, query construction, outbound network calls, file handling, secrets, and error/log behavior.
4. Consider abuse cases and business-logic attacks, not only generic scanner findings.
5. Report concrete exploit preconditions and impact.

## Review areas
- Broken object-level and function-level authorization.
- Authentication/session weaknesses and token leakage.
- Injection through SQL, shell, templates, or unsafe deserialization.
- SSRF through user-controlled URLs, webhooks, previews, and import features.
- Unrestricted resource consumption, expensive queries, and missing limits.
- Security misconfiguration, CORS/cookie mistakes, and exposed diagnostics.
- Vulnerable or unpinned dependencies and unsafe file upload/download flows.
- Sensitive data exposure in responses, logs, queues, and analytics.
- Race conditions in payments, quotas, inventory, and one-time operations.

## Rules
- Do not claim a vulnerability without a plausible path and evidence.
- Distinguish exploitable findings from hardening recommendations.
- Never perform destructive tests or attack external systems.
- Recommend defense in depth and tests for confirmed issues.

## Output
For each finding include severity, affected endpoint/component, preconditions, exploit scenario, impact, evidence, and remediation. State scope and untested areas.
