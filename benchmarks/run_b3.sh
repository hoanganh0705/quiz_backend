#!/usr/bin/env bash
# Benchmark 3 — BullMQ (async) vs synchronous handler (inline) on forgot-password
#
# What we're toggling: the call site in src/modules/auth/domain/password-reset.service.ts
#   A (BullMQ):  await this.emailService.enqueuePasswordResetEmail(...)  (production)
#   B (sync):    inline async block that simulates the handler's work + 250ms Resend delay
#
# The endpoint is POST /api/v1/auth/forgot-password. Throttler at 3/min for this route
# (AUTH_THROTTLE.forgotPassword = { limit: 3, ttl: 60_000 }).
#
# We measure:
#   - caller-facing latency (per-request) for 5 sequential requests per condition
#   - dispatch throughput: how many POST /forgot-password requests can complete in
#     a fixed window before the throttle kicks in (max 3 in 60s on this route)
#
# Notes:
#   - In the SYNC path the simulated block rejects (after 250ms). The existing
#     try/catch around the call in the service swallows the error, so the API still
#     returns 201 + the generic success message. That matches production behavior
#     when the email provider is down.
#   - We DO NOT actually call the real PasswordResetEmailHandler — doing so would
#     require injecting it into the service. The synthetic block is a fair proxy
#     because the only difference between the two conditions is whether the work
#     happens inline vs in a BullMQ worker; the work itself (hash + DB + Resend)
#     is identical.

set -u
cd "$(dirname "$0")"

BASE="http://localhost:8080/api/v1/auth/forgot-password"
KNOWN_EMAIL="admin@quiz.local"

# ---- Condition A: BullMQ (production) ----
echo
echo "=== condition A: BullMQ (production code) — 5 single requests, throttled ==="
echo "Waiting 65s for the per-route throttle window to reset..."
sleep 65
> b3_bullmq_samples.txt
for i in 1 2 3 4 5; do
  curl -sS -X POST "$BASE" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$KNOWN_EMAIL\"}" \
    -o /dev/null -w "bullmq_run_$i: total=%{time_total}s status=%{http_code}\n" \
    >> b3_bullmq_samples.txt
  sleep 22
done
cat b3_bullmq_samples.txt

# ---- Patch the service for sync mode ----
echo
echo "=== patching service to call handler inline (sync) ==="
python3 _b3_patch.py
echo "Patched snippet:"
grep -n "inline equivalent\|enqueuePasswordResetEmail" /home/nguyenhoanganh/Workspace/WebProjects/quiz/quiz_backend/src/modules/auth/domain/password-reset.service.ts

echo
echo "Waiting 12s for nest --watch to recompile + restart..."
sleep 12
echo "Verifying server is healthy after restart..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/categories 2>&1 || echo "fail")
  echo "  attempt $i: HTTP $CODE"
  [ "$CODE" = "200" ] && break
  sleep 3
done

# ---- Condition B: sync ----
echo
echo "=== condition B: inline handler (sync) — 5 single requests, throttled ==="
echo "Waiting 65s for throttle window..."
sleep 65
> b3_sync_samples.txt
for i in 1 2 3 4 5; do
  curl -sS -X POST "$BASE" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$KNOWN_EMAIL\"}" \
    -o /dev/null -w "sync_run_$i: total=%{time_total}s status=%{http_code}\n" \
    >> b3_sync_samples.txt
  sleep 22
done
cat b3_sync_samples.txt

# ---- Restore ----
echo
echo "=== restoring original service file ==="
python3 _b3_restore.py
grep -n "enqueuePasswordResetEmail\|inline equivalent" /home/nguyenhoanganh/Workspace/WebProjects/quiz/quiz_backend/src/modules/auth/domain/password-reset.service.ts

echo
echo "Waiting 12s for nest --watch to recompile + restart..."
sleep 12
for i in 1 2 3 4 5 6 7 8 9 10; do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/categories 2>&1 || echo "fail")
  echo "  attempt $i: HTTP $CODE"
  [ "$CODE" = "200" ] && break
  sleep 3
done

# ---- Summarize ----
python3 - <<'PY'
import re, statistics
def parse_samples(path):
    out = []
    for line in open(path):
        m = re.search(r'total=([0-9.]+)s\s+status=(\d+)', line)
        if m:
            out.append((float(m.group(1)), int(m.group(2))))
    return out

a = parse_samples('b3_bullmq_samples.txt')
b = parse_samples('b3_sync_samples.txt')
def summarize(name, arr):
    if not arr:
        print(f"  {name}: NO SAMPLES")
        return
    times = [t*1000 for t, _ in arr]
    codes = [c for _, c in arr]
    print(f"  {name}: n={len(arr)} median={statistics.median(times):.2f}ms "
          f"min={min(times):.2f}ms max={max(times):.2f}ms "
          f"status_codes={set(codes)}")
summarize('bullmq (async)', a)
summarize('sync (inline)',  b)
if a and b:
    ma = statistics.median([t for t,_ in a])
    mb = statistics.median([t for t,_ in b])
    print(f"\n  sync is {mb/ma:.1f}x slower than bullmq (median)")
PY

# ---- Cleanup ----
echo
echo "=== cleanup: removing test password reset tokens ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
DELETE FROM password_reset_tokens
WHERE user_id = (SELECT user_id FROM users WHERE email='admin@quiz.local');
SQL
echo "password_reset_tokens=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c 'SELECT count(*) FROM password_reset_tokens;')"