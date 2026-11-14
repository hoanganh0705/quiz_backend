---
name: nestjs-auth-security
description: Implements and audits NestJS authentication, JWT access and refresh tokens, session handling, guards, roles, permissions, cookies, and API security. Use for login, registration, token, authorization, or security changes.
---

# NestJS Authentication and Security

Security-sensitive changes require threat-aware reasoning. Never trade security for a shorter implementation.

## Workflow
Inspect the existing auth flow, token claims, cookie settings, guards, decorators, session storage, and configuration. Distinguish authentication from authorization and identify trust boundaries.

## JWT and session rules
- Validate signature, issuer, audience, expiry, and permitted algorithms.
- Use short-lived access tokens and deliberate refresh-token rotation/revocation when refresh tokens are used.
- Store only a cryptographic hash of refresh tokens or secrets when server-side persistence is required.
- Detect refresh-token reuse where supported and revoke the affected token family/session according to policy.
- Never put secrets, passwords, or sensitive personal data in JWT claims.
- Keep signing keys in validated secret configuration, never source control.
- Set cookie `httpOnly`, `secure` in production, and deliberate `sameSite`, `path`, and expiry. Assess CSRF risk from the actual cookie/cross-origin design.
- Never log raw tokens, passwords, authorization headers, or session secrets.

## Authorization
- Enforce permissions server-side for every protected operation.
- Use guards for route-level authorization and explicit policy/service checks for resource ownership and object-level access.
- Do not trust user IDs, roles, tenant IDs, or ownership fields supplied by clients.
- Ensure list, read, update, and delete operations all enforce object-level access.

## General API security
Validate untrusted input, rate-limit abuse-sensitive endpoints, avoid account enumeration where relevant, use established password hashing, and review CORS, uploads, and error responses.

## Verification
Test malformed/expired tokens, wrong issuer/audience, revoked sessions, refresh rotation/replay, and privilege-escalation paths. State assumptions that cannot be verified.
