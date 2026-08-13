# BENCHMARK 1 — Redis Cache Impact on `/api/v1/social/counts`

## What we're toggling

`GET /api/v1/social/counts` (auth'd) goes through `SocialCacheService.getCountsWithCache(userId, fetcher)` in `src/modules/social/infrastructure/cache/social-cache.service.ts`.

The cache key is `social:counts:<userId>`, TTL = 30 s.

- **WITH cache (warm)**: 1 Redis `GET` → `JSON.parse` → return. Zero DB hits.
- **WITHOUT cache (cold)**: `getOrSetWithStampedeProtection` falls through to the fetcher, which fires three `COUNT(*)` queries in parallel: `friendships` + `user_follows.following_id` + `user_follows.follower_id`.

The fetcher queries are already optimised (B-tree unique partial index on `(follower_id, following_id) WHERE deleted_at IS NULL`), so the SQL work is cheap — the cache benefit is most visible in **tail latency**.

We bypass the cache by `redis-cli DEL social:counts:<userId>` before every request in the "cold" condition. There is no code-level bypass flag exposed by `getCountsWithCache` (this is by design — every read is intentionally cache-first), so deleting the key is the only honest way to force a refetch without modifying application code.

## Reproduce

```bash
cd /home/nguyenhoanganh/Workspace/WebProjects/quiz/benchmarks
TOKEN=$(cat _admin_token.txt)             # admin user_id = 019fa348-6ad0-719b-a10b-b2ce0d6bfa62
USERID=019fa348-6ad0-719b-a10b-b2ce0d6bfa62
KEY=social:counts:$USERID
BASE="http://localhost:8080/api/v1/social/counts"

# Seed: 50000 synthetic users each following admin, so the 3 COUNTs do real work.
bash run_b1.sh                            # does seed + runs + cleanup automatically

# Standalone SQL-only baseline of the 3 COUNTs (no HTTP):
bash run_b1_sql_baseline.sh
```

## Raw measurements (n=20 sequential samples each, after seeding 50k follows)

| Condition            | median | min    | p90    | p99    | max    |
|----------------------|--------|--------|--------|--------|--------|
| **Cache WARM**       | 5.66ms | 1.65ms | 7.13ms | 7.86ms | 7.86ms |
| **Cache COLD**       | 6.64ms | 4.17ms | 13.03ms| 15.48ms| 15.48ms|

SQL-only baseline of the 3 COUNT(*) fetcher queries (same dataset, no HTTP/Redis):

| n  | median | min    | max   |
|----|--------|--------|-------|
| 10 | 4.57ms | 3.71ms | 9.16ms|

## Computed deltas

| Metric               | Cache WARM | Cache COLD | Δ (cold − warm) |
|----------------------|------------|------------|------------------|
| median latency       | 5.66 ms    | 6.64 ms    | **+0.99 ms (1.17× slower)** |
| p90 latency          | 7.13 ms    | 13.03 ms   | **+5.90 ms (1.83× slower)** |
| p99 latency          | 7.86 ms    | 15.48 ms   | **+7.62 ms (1.97× slower)** |
| min latency          | 1.65 ms    | 4.17 ms    | +2.52 ms |

## Honest interpretation

- **At the median**: ~1 ms saved per request. Real but small, because the underlying `COUNT(*)`s are sub-5ms already thanks to the partial unique index.
- **At the tail (p99)**: ~2× faster on cache hit. The cache masks DB hiccups; without it, every cold request can hit a slow COUNT (e.g. on the first request after the auth JWT verify pipeline is cold).
- **Architecture claim**: with 50k follow rows, the cache keeps the endpoint inside a 7–8 ms p99 envelope; without it, p99 nearly doubles. This is consistent with what `SocialCacheService`'s docstring claims: the cache exists primarily to keep social-counts reads **stable under load**, not to make a cheap query faster in absolute terms.

The numbers above are reproducible from `run_b1.sh` + `run_b1_sql_baseline.sh`. The repository state was restored to its pre-benchmark shape (6 users, 0 follows) at the end of each run.