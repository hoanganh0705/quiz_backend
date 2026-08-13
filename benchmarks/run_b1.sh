#!/usr/bin/env bash
# Benchmark 1 v4 — Redis cache impact (sequential, throttler-safe)
# Stays under the global 100 req/min throttle by issuing ~1 req/s.
# Measures /api/v1/social/counts under two conditions:
#   A. cache WARM  (key present in Redis)
#   B. cache COLD  (key deleted before each request → fetcher re-runs)
set -u
cd "$(dirname "$0")"

TOKEN=$(cat _admin_token.txt)
USERID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c \
  "SELECT user_id FROM users WHERE email='admin@quiz.local';")
KEY="social:counts:$USERID"
BASE="http://localhost:8080/api/v1/social/counts"
N=20   # samples per condition (low because of the 100/min throttle: 20 req = 12s/cond)

# ---- Seed ----
echo "=== seeding 50000 synthetic users + 50000 follow rows ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
INSERT INTO users (user_id, username, email, password_hash, role, is_verified, created_at, updated_at)
SELECT uuidv7(),
       'synth_follower_' || lpad(g::text, 6, '0'),
       'synth_follower_' || lpad(g::text, 6, '0') || '@bench.local',
       'BENCH_DUMMY_HASH',
       'user',
       false,
       now(),
       now()
FROM generate_series(1, 50000) AS g
ON CONFLICT DO NOTHING;
SQL
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
INSERT INTO user_follows (follow_id, follower_id, following_id, created_at)
SELECT uuidv7(),
       u.user_id,
       (SELECT user_id FROM users WHERE email = 'admin@quiz.local'),
       now()
FROM users u
WHERE u.email LIKE 'synth_follower_%@bench.local';
SQL
TOTAL_USERS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "SELECT count(*) FROM users;")
TOTAL_FOLLOWS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "SELECT count(*) FROM user_follows;")
echo "users=$TOTAL_USERS  user_follows=$TOTAL_FOLLOWS"

# Sanity: confirm cache key starts absent
echo "cache key $KEY exists? $(docker exec quizredis redis-cli EXISTS "$KEY")"

# ---- Condition A: cache WARM ----
echo
echo "=== condition A: cache WARM ($N sequential requests) ==="
# Warm once first
curl -sS -o /dev/null "$BASE" -H "Authorization: Bearer $TOKEN"
> b1_warm_samples.txt
for i in $(seq 1 $N); do
  curl -sS -o /dev/null -w "%{time_total}\n" "$BASE" -H "Authorization: Bearer $TOKEN" >> b1_warm_samples.txt
  sleep 0.8  # stay under throttle
done

# ---- Condition B: cache COLD ----
echo "=== condition B: cache COLD ($N requests, DEL key before each) ==="
> b1_cold_samples.txt
for i in $(seq 1 $N); do
  docker exec quizredis redis-cli DEL "$KEY" >/dev/null
  curl -sS -o /dev/null -w "%{time_total}\n" "$BASE" -H "Authorization: Bearer $TOKEN" >> b1_cold_samples.txt
  sleep 0.8
done

# ---- Summarize ----
python3 - <<PY
import statistics
warm = [float(x)*1000 for x in open('b1_warm_samples.txt') if x.strip()]
cold = [float(x)*1000 for x in open('b1_cold_samples.txt') if x.strip()]
def stats(name, arr):
    arr_sorted = sorted(arr)
    p50 = statistics.median(arr)
    p90 = arr_sorted[int(len(arr)*0.9)]
    p99 = arr_sorted[min(int(len(arr)*0.99), len(arr)-1)]
    print(f"{name:>8}: n={len(arr):>3} median={p50:.2f}ms min={min(arr):.2f}ms p90={p90:.2f}ms p99={p99:.2f}ms max={max(arr):.2f}ms")
stats('warm', warm)
stats('cold', cold)
med_warm = statistics.median(warm); med_cold = statistics.median(cold)
print(f"\\n  cold/warm ratio: {med_cold/med_warm:.2f}x")
print(f"  abs saving per request (median): {med_cold-med_warm:+.2f}ms")
PY

# ---- Cleanup ----
echo
echo "=== cleanup ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
DELETE FROM user_follows WHERE follower_id IN
  (SELECT user_id FROM users WHERE email LIKE 'synth_follower_%@bench.local');
DELETE FROM users WHERE email LIKE 'synth_follower_%@bench.local';
SQL
docker exec quizredis redis-cli DEL "$KEY" >/dev/null
echo "users=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c 'SELECT count(*) FROM users;')"
echo "user_follows=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c 'SELECT count(*) FROM user_follows;')"