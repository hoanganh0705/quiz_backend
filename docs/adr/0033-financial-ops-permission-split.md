# ADR-0033 — Financial Operation Permission Split

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-09-26 |

## Context

Coin ledger mutations were gated by a single `COIN_ADMIN` permission.
That collapsed three operationally distinct intents into one role,
with no per-admin ceiling:

- **Grant** — admin awards coins to a user (rewards, promotions).
- **Clawback** — admin removes coins from a user (fraud, refund).
- **Read ledger** — admin inspects the coin transaction history.

A compromised `COIN_ADMIN` token could grant unbounded coins, claw
back any balance, and read the full ledger. The Phase 8 audit
flagged that no per-admin daily cap existed, so a single compromised
operator account could move an arbitrary amount before detection.

## Decision

`COIN_ADMIN` is split into three permissions, and a server-side
daily cap is enforced:

- **`COIN_GRANT`** — required to mutate a user's balance upward.
- **`COIN_CLAWBACK`** — required to mutate a user's balance
  downward.
- **`COIN_READ_LEDGER`** — required to read the coin transaction
  history; not required for grant or clawback.

Additional invariants:

- **Per-admin daily cap.** A single admin cannot grant more than
  `COIN_ADMIN_DAILY_CAP` (default 10,000,000 coins) per UTC day. The
  cap is enforced server-side; the operator dashboard surfaces the
  remaining quota.
- **Self-adjustment refused.** An admin cannot grant or clawback
  coins to or from their own userId. The refusal is enforced in
  `CoinApplicationService` and emits an audit event.
- **Metrics.** `quiz_coin_admin_grant_total` and
  `quiz_coin_admin_clawback_total` are emitted with an `adminId`
  label so the on-call can alert on a single admin crossing a
  threshold.

## Consequences

### Positive

- A compromised `COIN_GRANT` token cannot clawback or read the
  ledger; a compromised `COIN_READ_LEDGER` token cannot mutate.
- The daily cap bounds blast radius regardless of how many
  operators are compromised simultaneously.
- The self-adjustment refusal closes the trivial privilege
  escalation path where an admin awards themselves coins.

### Negative

- Operators that previously held `COIN_ADMIN` must be re-issued
  the split permissions. The migration script and the
  auth-permission matrix document the mapping.
- The daily cap is a soft business limit, not a hard security
  boundary; the runbook still treats any cap-raising event as
  suspicious.

## Evidence

- `src/core/config/coin-admin.config.ts`
  (`COIN_ADMIN_DAILY_CAP`).
- `src/modules/coins/application/coin.application.service.ts`
  (split permissions, daily cap, self-refusal).
- `src/modules/coins/transport/gateway/coin.gateway.ts`.
- `src/core/observability/metrics.registry.ts`
  (`quiz_coin_admin_grant_total`,
  `quiz_coin_admin_clawback_total`).
- `docs/standards/migration.md` § "Financial operation permission split".

## References

- ADR-0013 (Authorization Model — Three-Layer RBAC + Permissions).
- ADR-0014 (Event Architecture — Three-Layer Event Bus).
- `docs/audit/phase8-security-trust-boundary-audit.md`.
- `docs/audit/phase9-security-remediation-plan.md` § P3.7.
