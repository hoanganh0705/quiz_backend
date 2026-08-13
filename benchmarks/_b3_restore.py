#!/usr/bin/env python3
"""Reverse the patch applied by _b3_patch.py."""
import pathlib, sys

SERVICE_FILE = "/home/nguyenhoanganh/Workspace/WebProjects/quiz/quiz_backend/src/modules/auth/domain/password-reset.service.ts"

p = pathlib.Path(SERVICE_FILE)
src = p.read_text()

NEW = """await new Promise<void>((_resolve, reject) => {
      // Inline equivalent of the enqueue + handler, for B3 sync benchmark.
      // Order mirrors the handler: token-hash + token-row SELECT + Resend send.
      setTimeout(() => reject(new Error('bench: simulated Resend send failed')), 250);
    });"""

OLD = "await this.emailService.enqueuePasswordResetEmail(normalizedEmail, token, user.userId);"

if NEW not in src:
    print("NEW pattern not found — file may already be restored.")
    sys.exit(1)

p.write_text(src.replace(NEW, OLD, 1))
print("restored")