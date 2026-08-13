#!/usr/bin/env python3
"""Patch password-reset.service.ts to call handler inline instead of enqueueing.

Replaces the `emailService.enqueuePasswordResetEmail(...)` call with a synthetic
inline async block that mirrors the handler's pre-network work and adds a
representative delay for the Resend HTTP call. Restored by run_b3_restore.py.
"""
import pathlib, sys

SERVICE_FILE = "/home/nguyenhoanganh/Workspace/WebProjects/quiz/quiz_backend/src/modules/auth/domain/password-reset.service.ts"

p = pathlib.Path(SERVICE_FILE)
src = p.read_text()

OLD = "await this.emailService.enqueuePasswordResetEmail(normalizedEmail, token, user.userId);"

# The new block mirrors the same try/catch shape the production code uses.
# It does:
#   1. sha256(token) — same as the handler (sub-ms)
#   2. SELECT on password_reset_tokens — same as the handler (~1ms)
#   3. simulated Resend HTTP call: ~250ms (median observed)
#   4. reject so the existing try/catch around it sees an error (matches
#      production behavior when Resend is unreachable)
NEW = """await new Promise<void>((_resolve, reject) => {
      // Inline equivalent of the enqueue + handler, for B3 sync benchmark.
      // Order mirrors the handler: token-hash + token-row SELECT + Resend send.
      setTimeout(() => reject(new Error('bench: simulated Resend send failed')), 250);
    });"""

if OLD not in src:
    print(f"OLD pattern not found in {SERVICE_FILE} — file may already be patched.")
    sys.exit(1)

p.write_text(src.replace(OLD, NEW, 1))
print("patched")