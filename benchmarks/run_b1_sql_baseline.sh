#!/usr/bin/env bash
# Baseline SQL cost of the 3 COUNT queries — independent of HTTP.
# Re-runs the same 3 queries the cache's fetcher fires, against the same dataset
# that B1 just measured against. Excludes HTTP/auth/Redis.
set -u
cd "$(dirname "$0")"

USERID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c \
  "SELECT user_id FROM users WHERE email='admin@quiz.local';")

# Seed (same as run_b1.sh but kept inline so this script is self-contained)
echo "=== seeding 50000 follows ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL' >/dev/null
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
INSERT INTO user_follows (follow_id, follower_id, following_id, created_at)
SELECT uuidv7(),
       u.user_id,
       (SELECT user_id FROM users WHERE email = 'admin@quiz.local'),
       now()
FROM users u
WHERE u.email LIKE 'synth_follower_%@bench.local';
SQL

echo
echo "=== 10 sequential SQL timings of the 3 COUNT(*)s (the cache fetcher) ==="
> b1_sql_samples.txt
for i in $(seq 1 10); do
  PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "
SELECT
  (SELECT count(*) FROM friendships
     WHERE (requester_id='$USERID' OR addressee_id='$USERID')
       AND status='accepted' AND deleted_at IS NULL),
  (SELECT count(*) FROM user_follows
     WHERE following_id='$USERID' AND deleted_at IS NULL),
  (SELECT count(*) FROM user_follows
     WHERE follower_id='$USERID' AND deleted_at IS NULL);
" >/dev/null
  # Time the exact round trip from psql -- but that includes TCP/parse overhead.
  # Better: time EXPLAIN ANALYZE which reports server-side Execution Time.
  EXPLAIN_TIME=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "
EXPLAIN (ANALYZE, FORMAT JSON)
SELECT
  (SELECT count(*) FROM friendships
     WHERE (requester_id='$USERID' OR addressee_id='$USERID')
       AND status='accepted' AND deleted_at IS NULL) AS friends,
  (SELECT count(*) FROM user_follows
     WHERE following_id='$USERID' AND deleted_at IS NULL) AS followers,
  (SELECT count(*) FROM user_follows
     WHERE follower_id='$USERID' AND deleted_at IS NULL) AS following;
" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['Execution Time'])")
  echo "$EXPLAIN_TIME" >> b1_sql_samples.txt
done

python3 - <<PY
import statistics
arr = [float(x) for x in open('b1_sql_samples.txt') if x.strip()]
print(f"  n={len(arr)} median={statistics.median(arr):.2f}ms min={min(arr):.2f}ms max={max(arr):.2f}ms")
PY

# Cleanup
echo
echo "=== cleanup ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
DELETE FROM user_follows WHERE follower_id IN
  (SELECT user_id FROM users WHERE email LIKE 'synth_follower_%@bench.local');
DELETE FROM users WHERE email LIKE 'synth_follower_%@bench.local';
SQL
echo "users=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c 'SELECT count(*) FROM users;')"
echo "user_follows=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c 'SELECT count(*) FROM user_follows;')"