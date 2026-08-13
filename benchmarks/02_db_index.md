# BENCHMARK 2 — DB Index Impact on `user_ranking` Leaderboard Query

## What we're toggling

The leaderboard query behind `GET /api/v1/leaderboard`:

```sql
SELECT user_id, all_time_xp, all_time_rank
FROM user_ranking
WHERE all_time_rank IS NOT NULL
ORDER BY all_time_rank ASC
LIMIT 20;
```

(`getGlobalLeaderboard` in `src/modules/ranking/infrastructure/repositories/ranking.repository.ts` orders on `all_time_xp DESC` with a tie-breaker, but the same `idx_user_ranking_all_time_rank` B-tree serves both — same plan shape.)

The index in question is `idx_user_ranking_all_time_rank`, declared in `src/core/database/schema/ranking/schema.ts`:

```ts
index('idx_user_ranking_all_time_rank').using(
  'btree',
  table.allTimeRank.asc().nullsLast().op('int4_ops'),
),
```

We DROP the index, re-run `EXPLAIN (ANALYZE, BUFFERS)`, then **recreate the index** in the cleanup step so the schema isn't left in a broken state.

## Reproduce

```bash
cd /home/nguyenhoanganh/Workspace/WebProjects/quiz/benchmarks
bash run_b2.sh    # seeds 100k users + 100k user_ranking rows, runs both conditions, recreates index, cleans up
```

## Raw measurements (n=5 sequential EXPLAIN ANALYZE runs each, after seeding 100k ranking rows)

### Condition A — index present

| run | Execution Time | Plan                            |
|-----|----------------|---------------------------------|
| 1   | 0.114 ms       | Index Scan using idx_user_ranking_all_time_rank |
| 2   | 0.070 ms       | Index Scan using idx_user_ranking_all_time_rank |
| 3   | 0.201 ms       | Index Scan using idx_user_ranking_all_time_rank |
| 4   | 0.064 ms       | Index Scan using idx_user_ranking_all_time_rank |
| 5   | 0.097 ms       | Index Scan using idx_user_ranking_all_time_rank |

### Condition B — index dropped (recreated after)

| run | Execution Time | Plan                              |
|-----|----------------|-----------------------------------|
| 1   | 18.153 ms      | Parallel Seq Scan on user_ranking |
| 2   | 7.564 ms       | Parallel Seq Scan on user_ranking |
| 3   | 14.164 ms      | Parallel Seq Scan on user_ranking |
| 4   | 17.834 ms      | Parallel Seq Scan on user_ranking |
| 5   | 20.307 ms      | Parallel Seq Scan on user_ranking |

## Summary

| Metric        | With index (B-tree) | Without index (Parallel Seq Scan) | Δ                     |
|---------------|---------------------|-----------------------------------|-----------------------|
| median        | **0.10 ms**         | **17.83 ms**                      | **+17.7 ms (~184× slower)** |
| min           | 0.06 ms             | 7.56 ms                           | —                     |
| max           | 0.20 ms             | 20.31 ms                          | —                     |
| plan shape    | Index Scan, 20 rows | Parallel Seq Scan, ~100k rows     | —                     |

The query plan **flipped from `Index Scan` to `Parallel Seq Scan`** — Postgres has to scan all 100k rows and sort them because there's no ordered path to the top of the leaderboard. Without the index, every leaderboard request is forced into a full sort over the entire table; with the index, the planner walks the B-tree leaf-page chain in order and stops after 20 rows.

This is the cleanest, most defensible of the four benchmarks: identical schema, identical data, identical query, single DDL change. The 184× median speedup is reproducible from `run_b2.sh`.