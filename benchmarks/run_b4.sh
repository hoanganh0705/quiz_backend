#!/usr/bin/env bash
# Benchmark 4 — Cursor vs Offset pagination at scale
#
# Seed: 100000 quizzes (active, not deleted) created_at spread over time.
#   The cursor query uses the indexed quiz_id as the cursor key.
#   The offset query uses OFFSET 50000 LIMIT 20 (equivalent page depth).
#   We also measure how both scale: query 10 pages at different depths
#   (OFFSET 10, 100, 1000, 10000, 50000) vs the equivalent cursor positions.
#
# Why quiz_id as cursor?
#   quiz_id is a ULID-style v7 UUID — lexicographically sortable by created_at.
#   Ordering by quiz_id DESC gives the same order as created_at DESC with fewer
#   null-headaches. The idx_quizzes_active_created_at partial index supports
#   the offset path; no special index needed for cursor (PK is already indexed).

set -u
cd "$(dirname "$0")"

USERID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c \
  "SELECT user_id FROM users WHERE email='admin@quiz.local';")
CREATOR_COUNT=5  # number of real creator users to cycle through

# ---- Seed: 100000 quizzes ----
echo "=== seeding 100000 quizzes ==="
# Create synthetic creator users if needed
EXISTING=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c \
  "SELECT count(*) FROM users WHERE email LIKE 'quizbench_%@bench.local';")
echo "existing quizbench users: $EXISTING"
if [ "$EXISTING" -eq 0 ]; then
  PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
INSERT INTO users (user_id, username, email, password_hash, role, is_verified, created_at, updated_at)
SELECT uuidv7(),
       'quizbench_user_' || lpad(g::text, 6, '0'),
       'quizbench_user_' || lpad(g::text, 6, '0') || '@bench.local',
       'BENCH_DUMMY_HASH',
       'user',
       false,
       now(),
       now()
FROM generate_series(1, 50) AS g;
SQL
  echo "created 50 quizbench users"
fi

# Cycle through a fixed pool of creator user IDs
CREATORS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c \
  "SELECT user_id FROM users WHERE email LIKE 'quizbench_%@bench.local' LIMIT 5;")
CREATOR_ARR=()
while IFS= read -r uid; do CREATOR_ARR+=("$uid"); done <<< "$CREATORS"
N_CREATORS=${#CREATOR_ARR[@]}
echo "N_CREATORS=$N_CREATORS"

# Bulk insert 100k quizzes
echo "Inserting 100000 quizzes..."
# Avoid cross join: generate 100000 quiz rows, each assigned to a creator via modulo.
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
INSERT INTO quizzes (quiz_id, creator_id, title, slug, created_at, updated_at)
SELECT uuidv7(),
       c.user_id,
       'Benchmark Quiz ' || gs.n,
       'bench-quiz-' || gs.n || '-' || md5(random()::text),
       now() - (gs.n * interval '1 second'),
       now() - (gs.n * interval '1 second')
FROM generate_series(1, 100000) AS gs(n)
CROSS JOIN LATERAL (
  SELECT user_id FROM users
  WHERE email LIKE 'quizbench_%@bench.local'
  ORDER BY user_id
  LIMIT 1 OFFSET (gs.n - 1) % 5
) AS c(user_id);
SQL
QCOUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "SELECT count(*) FROM quizzes WHERE deleted_at IS NULL;")
echo "active quizzes after seed: $QCOUNT"

# Warm buffer cache
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "ANALYZE quizzes;" >/dev/null

# ---- The two query forms ----
# OFFSET query (current production)
OFFSET_QUERY_BASE="
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT quiz_id, title, slug, created_at
FROM quizzes
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20
OFFSET "
# OFFSET 0, 10, 100, 1000, 10000, 50000

# CURSOR query (equivalent: ORDER BY quiz_id DESC, WHERE quiz_id < last_cursor)
# quiz_id is a v7 UUID (lexicographic timestamp), so DESC order matches created_at DESC.
# This finds the Nth quiz by created_at without scanning all prior rows.
CURSOR_QUERY_BASE="
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH cursor_target AS (
  SELECT quiz_id FROM quizzes
  WHERE deleted_at IS NULL
  ORDER BY quiz_id DESC
  LIMIT \$1
)
SELECT q.quiz_id, q.title, q.slug, q.created_at
FROM quizzes q
WHERE deleted_at IS NULL
  AND q.quiz_id < (SELECT quiz_id FROM cursor_target LIMIT 1 OFFSET \$2)
ORDER BY q.quiz_id DESC
LIMIT 20;
"
# \$1 = how many rows to look back (offset depth), \$2 = cursor skip within that window

run_explain() {
  local query="$1"
  local label="$2"
  PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "$query" 2>&1 \
    | grep -E 'Execution Time|Seq Scan|Index|Cost' | head -5
}

# ---- Run both query forms at each depth ----
echo
echo "=== offset pagination at various depths ==="
for DEPTH in 0 10 100 1000 10000 50000; do
  echo -n "OFFSET $DEPTH: "
  T=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "${OFFSET_QUERY_BASE}${DEPTH};" \
      | grep 'Execution Time' | grep -oE '[0-9]+\.[0-9]+')
  echo "${T}ms"
done

echo
echo "=== cursor pagination at various depths ==="
# Use psql -c with parameterized queries instead of bash variable interpolation
for DEPTH in 0 10 100 1000 10000 50000; do
  echo -n "cursor skip=$DEPTH: "
  # Use COPY to get the target quiz_id first, then run cursor EXPLAIN in the same psql call
  PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c "
DO \$\$
DECLARE
  target_id uuid;
  t_ms real;
BEGIN
  -- Get quiz_id at depth N using quiz_id DESC order (matches cursor)
  SELECT quiz_id INTO target_id
  FROM quizzes
  WHERE deleted_at IS NULL
  ORDER BY quiz_id DESC
  LIMIT 1 OFFSET ${DEPTH};

  IF target_id IS NULL THEN
    RAISE NOTICE 'skip=DEPTH: table has fewer than ${DEPTH}+1 rows';
    RETURN;
  END IF;

  -- Run EXPLAIN ANALYZE and capture the Execution Time line
  CREATE TEMP TABLE _cursor_result AS
  SELECT q.quiz_id, q.title, q.slug, q.created_at
  FROM quizzes q
  WHERE q.deleted_at IS NULL
    AND q.quiz_id < target_id
  ORDER BY q.quiz_id DESC
  LIMIT 20;

  GET DIAGNOSTICS t_ms = LAST_VALUE;
END
\$\$;
" 2>&1 | head -5
  echo
done

echo
echo "=== End-to-end latency simulation: 20 sequential pages ==="
echo "(simulate client paginating forward from page 1 to page 20, each 20 items)"
echo "-- offset pagination (pages 1-20, each offset = (page-1)*20) --"
python3 - <<'PY'
import time, subprocess, re

def run_offset(offset, limit=20):
    q = f"EXPLAIN (ANALYZE, FORMAT TEXT) SELECT quiz_id, title, slug, created_at FROM quizzes WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT {limit} OFFSET {offset};"
    r = subprocess.run(['psql', '-h', 'localhost', '-U', 'postgres', '-d', 'quizdb', '-At', '-c', q],
                      capture_output=True, text=True, env={'PGPASSWORD': 'postgres'})
    m = re.search(r'Execution Time: ([0-9.]+) ms', r.stdout)
    return float(m.group(1)) if m else None

def run_cursor(cursor_id, limit=20):
    q = f"EXPLAIN (ANALYZE, FORMAT TEXT) SELECT q.quiz_id, q.title, q.slug, q.created_at FROM quizzes q WHERE deleted_at IS NULL AND q.quiz_id < '{cursor_id}' ORDER BY q.quiz_id DESC LIMIT {limit};"
    r = subprocess.run(['psql', '-h', 'localhost', '-U', 'postgres', '-d', 'quizdb', '-At', '-c', q],
                      capture_output=True, text=True, env={'PGPASSWORD': 'postgres'})
    m = re.search(r'Execution Time: ([0-9.]+) ms', r.stdout)
    return float(m.group(1)) if m else None

def get_cursor_id(depth):
    q = f"SELECT quiz_id FROM quizzes WHERE deleted_at IS NULL ORDER BY quiz_id DESC LIMIT 1 OFFSET {depth};"
    r = subprocess.run(['psql', '-h', 'localhost', '-U', 'postgres', '-d', 'quizdb', '-At', '-c', q],
                        capture_output=True, text=True, env={'PGPASSWORD': 'postgres'})
    return r.stdout.strip()

print(f"{'page':>4}  {'offset':>8}  {'offset_ms':>10}  {'cursor_ms':>10}  {'ratio':>6}")
print("-" * 50)
for page in range(1, 21):
    offset = (page - 1) * 20
    off_ms = run_offset(offset)
    cursor_id = get_cursor_id(offset)
    cur_ms = run_cursor(cursor_id) if cursor_id else None
    ratio = off_ms / cur_ms if cur_ms else None
    ratio_str = f"{ratio:.2f}x" if ratio else "N/A"
    print(f"{page:>4}  {offset:>8}  {off_ms:>10.3f}  {cur_ms:>10.3f}  {ratio_str:>6}")
PY

# ---- Cleanup ----
echo
echo "=== cleanup ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -q <<'SQL'
DELETE FROM quizzes WHERE slug LIKE 'bench-quiz-%';
DELETE FROM users WHERE email LIKE 'quizbench_%@bench.local';
SQL
echo "quizzes=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c 'SELECT count(*) FROM quizzes;')"
echo "users=$(PGPASSWORD=postgres psql -h localhost -U postgres -d quizdb -At -c 'SELECT count(*) FROM users;')"