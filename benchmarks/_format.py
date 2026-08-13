#!/usr/bin/env python3
"""Print a single-line summary from autocannon JSON."""
import json
import sys

r = json.load(sys.stdin)
print(
    f"{sys.argv[1]:>10}: "
    f"reqs={r['requests']['total']:>5} "
    f"rps={r['requests']['average']:>6.1f} "
    f"p50={r['latency']['p50']:>6.2f}ms "
    f"p90={r['latency']['p90']:>6.2f}ms "
    f"p99={r['latency']['p99']:>6.2f}ms "
    f"2xx={r['2xx']:>5} "
    f"errs={r['non2xx']:>5}"
)