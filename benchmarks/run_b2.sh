#!/usr/bin/env bash
# Benchmark 2 — DB index impact on user_ranking leaderboard query
#   EXPLAIN (ANALYZE, BUFFERS) on the same query, WITH idx_user_ranking_all_time_rank and WITHOUT.
#   Repeats 5x in each condition; reports the median Execution Time per condition.
set -u
cd "$(dirname "$0")"

USERID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c \
  "SELECT user_id FROM users WHERE email='admin@quiz.local';")
INDEX_NAME="idx_user_ranking_all_time_rank"

# ---- Seed: 100000 synthetic users, each with a user_ranking row ----
echo "=== seeding 100000 synthetic users + 100000 user_ranking rows ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
INSERT INTO users (user_id, username, email, password_hash, role, is_verified, created_at, updated_at)
SELECT uuidv7(),
       'rankbench_user_' || lpad(g::text, 7, '0'),
       'rankbench_user_' || lpad(g::text, 7, '0') || '@bench.local',
       'BENCH_DUMMY_HASH',
       'user',
       false,
       now(),
       now()
FROM generate_series(1, 100000) AS g;
SQL
echo "users after synth insert: $(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c 'SELECT count(*) FROM users;')"

PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
-- Pair each synthetic user with exactly one ranking row using row_number over the
-- synthetic-user set. The (user_id) PK guarantees uniqueness; we just need a 1:1
-- join between generate_series(1,100000) and the synthetic users.
WITH synthetic AS (
  SELECT user_id FROM users WHERE email LIKE 'rankbench_user_%@bench.local'
), numbered AS (
  SELECT user_id, row_number() OVER () AS n FROM synthetic
)
INSERT INTO user_ranking (user_id, all_time_xp, all_time_rank, weekly_xp, monthly_xp, daily_xp, is_dirty)
SELECT numbered.user_id,
       (100000 - numbered.n) * 10,
       numbered.n,
       0, 0, 0, false
FROM numbered;
SQL
TOTAL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "SELECT count(*) FROM user_ranking;")
echo "user_ranking count after seed: $TOTAL"

# Warm up the buffer cache + stats so the first run isn't an outlier
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "ANALYZE user_ranking;" >/dev/null

# ---- The query the leaderboard endpoint actually fires ----
QUERY="
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, all_time_xp, all_time_rank
FROM user_ranking
WHERE all_time_rank IS NOT NULL
ORDER BY all_time_rank ASC
LIMIT 20;
"

# ---- Condition A: WITH the index ----
echo
echo "=== condition A: WITH idx_user_ranking_all_time_rank (5 runs) ==="
> b2_with_samples.txt
for i in 1 2 3 4 5; do
  T=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "$QUERY" \
      | grep -E 'Execution Time' | head -1 | grep -oE '[0-9]+\.[0-9]+')
  echo "$T" >> b2_with_samples.txt
  PLAN=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -c "$QUERY" 2>&1 \
        | grep -E 'Index Scan|Seq Scan' | head -2 | tr '\n' '|')
  echo "  run_$i: ${T}ms  plan=$PLAN"
done

# ---- Condition B: DROP the index ----
echo
echo "=== condition B: WITHOUT idx_user_ranking_all_time_rank (DROP, 5 runs) ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -c "DROP INDEX IF EXISTS $INDEX_NAME;"
> b2_without_samples.txt
for i in 1 2 3 4 5; do
  T=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "$QUERY" \
      | grep -E 'Execution Time' | head -1 | grep -oE '[0-9]+\.[0-9]+')
  echo "$T" >> b2_without_samples.txt
  PLAN=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -c "$QUERY" 2>&1 \
        | grep -E 'Index Scan|Seq Scan' | head -2 | tr '\n' '|')
  echo "  run_$i: ${T}ms  plan=$PLAN"
done

# ---- Recreate the index (do NOT leave schema broken) ----
echo
echo "=== recreating index $INDEX_NAME ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -c "
CREATE INDEX IF NOT EXISTS $INDEX_NAME ON user_ranking USING btree (all_time_rank ASC NULLS LAST);
"

# ---- Summarize ----
python3 - <<PY
import statistics
with_idx = [float(x) for x in open('b2_with_samples.txt') if x.strip()]
no_idx   = [float(x) for x in open('b2_without_samples.txt') if x.strip()]
def stats(name, arr):
    arr_sorted = sorted(arr)
    print(f"  {name:>10}: n={len(arr)} median={statistics.median(arr):.2f}ms min={min(arr):.2f}ms max={max(arr):.2f}ms samples={arr}")
stats('with_index', with_idx)
stats('no_index',   no_idx)
mw = statistics.median(with_idx); mn = statistics.median(no_idx)
print(f"\n  slowdown without index: {mn/mw:.1f}x  (median {mw}ms -> {mn}ms)")
PY

# ---- Cleanup ----
echo
echo "=== cleanup ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
DELETE FROM user_ranking WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'rankbench_user_%@bench.local');
DELETE FROM users WHERE email LIKE 'rankbench_user_%@bench.local';
SQL
echo "user_ranking=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c 'SELECT count(*) FROM user_ranking;')"
echo "users=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c 'SELECT count(*) FROM users;')"