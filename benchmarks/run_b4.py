#!/usr/bin/env python3
"""
Benchmark 4 — Cursor vs Offset pagination at scale

Seed: 100000 quizzes (active, not deleted) created_at spread over time.
Measures: EXPLAIN (ANALYZE) for offset pagination at depths 0-50000
         vs equivalent cursor-based pagination.
"""
import subprocess, re, os, time

ENV = dict(os.environ)
ENV['PGPASSWORD'] = 'postgres'

def psql(q, single_line=True):
    r = subprocess.run(
        ['psql', '-h', 'localhost', '-U', 'postgres', '-d', 'quizdb', '-At', '-c', q],
        capture_output=True, text=True, env=ENV
    )
    return r.stdout.strip() if single_line else (r.stdout, r.stderr)

def psql_raw(q):
    r = subprocess.run(
        ['psql', '-h', 'localhost', '-U', 'postgres', '-d', 'quizdb', '-At', '-c', q],
        capture_output=True, text=True, env=ENV
    )
    return r.stdout

def explain_ms(query):
    out = psql_raw(f"EXPLAIN (ANALYZE, FORMAT TEXT) {query}")
    m = re.search(r'Execution Time: ([0-9.]+) ms', out)
    return float(m.group(1)) if m else None

def explain_plan(query):
    out = psql_raw(f"EXPLAIN (ANALYZE, FORMAT TEXT) {query}")
    lines = [l.strip() for l in out.splitlines() if l.strip()]
    # Find the node types
    scan_type = next((l for l in lines if 'Seq Scan' in l or 'Index' in l), 'unknown')
    return scan_type

# ── Seed ────────────────────────────────────────────────────────────────────
print("=== seeding 100000 quizzes ===")

# Create 50 synthetic creator users
existing = psql("SELECT count(*) FROM users WHERE email LIKE 'quizbench_%@bench.local';")
print(f"  existing quizbench users: {existing}")
if existing == '0':
    psql("""
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
""")
    print("  created 50 quizbench users")

# Insert 100000 quizzes, cycling through the 5 creator user IDs.
# LATERAL with generate_series avoids cross-product: each quiz gets exactly one creator.
n_quizzes = psql("SELECT count(*) FROM quizzes WHERE slug LIKE 'bench-quiz-%';")
print(f"  existing bench quizzes: {n_quizzes}")

if n_quizzes == '0':
    insert_q = """
INSERT INTO quizzes (quiz_id, creator_id, title, slug, created_at, updated_at)
SELECT uuidv7(),
       c.user_id,
       'Benchmark Quiz ' || gs.n,
       'bench-quiz-' || gs.n || '-' || md5(random()::text),
       now() - (gs.n * interval '1 second'),
       now() - (gs.n * interval '1 second')
FROM generate_series(1, 100000) AS gs(n),
LATERAL (
  SELECT user_id FROM users
  WHERE email LIKE 'quizbench_%@bench.local'
  ORDER BY user_id
  LIMIT 1 OFFSET (gs.n - 1) % 5
) AS c(user_id);
"""
    psql(insert_q)
    print("  inserted 100000 quizzes")
else:
    print(f"  skipping insert, {n_quizzes} bench quizzes already exist")

qcount = psql("SELECT count(*) FROM quizzes WHERE deleted_at IS NULL;")
print(f"  active quizzes: {qcount}")

# Warm the buffer cache
psql("ANALYZE quizzes;")

# ── EXPLAIN ANALYZE: Offset pagination at various depths ───────────────────────
print()
print("=== offset pagination EXPLAIN ANALYZE at various depths ===")
print(f"  {'depth':>8}  {'ms':>8}  scan_type")
print("  " + "-" * 40)

DEPTHS = [0, 10, 100, 1000, 10000, 50000]
offset_results = {}
for d in DEPTHS:
    q = f"""
SELECT quiz_id, title, slug, created_at
FROM quizzes
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20 OFFSET {d};
"""
    ms = explain_ms(q)
    offset_results[d] = ms
    print(f"  {d:>8}  {ms:>8.3f} ms")

# ── Cursor pagination ─────────────────────────────────────────────────────────
# quiz_id is UUIDv7 (lexicographic timestamp). Ordering by quiz_id DESC
# matches created_at DESC for sequential scans.
print()
print("=== cursor pagination EXPLAIN ANALYZE at various depths ===")
print(f"  {'skip':>8}  {'ms':>8}  scan_type")
print("  " + "-" * 40)

cursor_results = {}
for d in DEPTHS:
    # Get the quiz_id at position d (in quiz_id DESC order = cursor position d)
    target_q = f"SELECT quiz_id FROM quizzes WHERE deleted_at IS NULL ORDER BY quiz_id DESC LIMIT 1 OFFSET {d};"
    target_id = psql(target_q)
    if not target_id:
        print(f"  {d:>8}  {'N/A':>8}  (table has < {d+1} rows)")
        cursor_results[d] = None
        continue

    # Cursor query: all rows AFTER this quiz_id (i.e., older in created_at order)
    q = f"""
SELECT q.quiz_id, q.title, q.slug, q.created_at
FROM quizzes q
WHERE q.deleted_at IS NULL
  AND q.quiz_id < '{target_id}'
ORDER BY q.quiz_id DESC
LIMIT 20;
"""
    ms = explain_ms(q)
    plan = explain_plan(q)
    cursor_results[d] = ms
    print(f"  {d:>8}  {ms:>8.3f} ms  {plan}")

# ── Page-by-page simulation: 20 pages ────────────────────────────────────────
print()
print("=== page-by-page simulation (pages 1-20) ===")
print(f"  {'page':>4}  {'offset':>8}  {'offset_ms':>10}  {'cursor_ms':>10}  {'ratio':>6}")
print("  " + "-" * 50)

offset_samples = []
cursor_samples = []
for page in range(1, 21):
    offset = (page - 1) * 20

    # Offset query
    q_off = f"""
SELECT quiz_id, title, slug, created_at
FROM quizzes
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20 OFFSET {offset};
"""
    off_ms = explain_ms(q_off)
    offset_samples.append(off_ms)

    # Cursor query
    target_id = psql(f"SELECT quiz_id FROM quizzes WHERE deleted_at IS NULL ORDER BY quiz_id DESC LIMIT 1 OFFSET {offset};")
    if target_id:
        q_cur = f"""
SELECT q.quiz_id, q.title, q.slug, q.created_at
FROM quizzes q
WHERE q.deleted_at IS NULL
  AND q.quiz_id < '{target_id}'
ORDER BY q.quiz_id DESC
LIMIT 20;
"""
        cur_ms = explain_ms(q_cur)
        cursor_samples.append(cur_ms)
        ratio = f"{off_ms/cur_ms:.2f}x" if cur_ms else "N/A"
    else:
        cur_ms = None
        cursor_samples.append(None)
        ratio = "N/A"

    off_str = f"{off_ms:.3f}" if off_ms else "FAIL"
    cur_str = f"{cur_ms:.3f}" if cur_ms else "FAIL"
    print(f"  {page:>4}  {offset:>8}  {off_str:>10}  {cur_str:>10}  {ratio:>6}")

# ── Summary ──────────────────────────────────────────────────────────────────
print()
print("=== Summary ===")
valid_offsets = [x for x in offset_samples if x]
valid_cursors = [x for x in cursor_samples if x]
if valid_offsets:
    import statistics
    med_off = statistics.median(valid_offsets)
    max_off = max(valid_offsets)
    print(f"  Offset: median={med_off:.3f}ms  max={max_off:.3f}ms (over 20 pages)")
if valid_cursors:
    med_cur = statistics.median(valid_cursors)
    max_cur = max(valid_cursors)
    print(f"  Cursor: median={med_cur:.3f}ms  max={max_cur:.3f}ms (over 20 pages)")
    if valid_offsets and valid_cursors:
        print(f"  Slowdown at depth: {max_off/max_cur:.1f}x at page 20")
        print(f"  Median ratio (offset/cursor): {med_off/med_cur:.2f}x")

# ── Cleanup ───────────────────────────────────────────────────────────────────
print()
print("=== cleanup ===")
psql("DELETE FROM quizzes WHERE slug LIKE 'bench-quiz-%';")
psql("DELETE FROM users WHERE email LIKE 'quizbench_%@bench.local';")
print(f"  quizzes: {psql('SELECT count(*) FROM quizzes;')}")
print(f"  users: {psql('SELECT count(*) FROM users;')}")