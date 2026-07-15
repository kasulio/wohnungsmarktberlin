/**
 * Process-local fixed-window rate limiter. Fine for a single Coolify replica
 * (SQLite already implies one writer). Counters reset on restart — acceptable.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Opportunistic sweep so the Map doesn't grow forever under many unique IPs. */
export const MAX_BUCKETS = 10_000;

function sweep(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
  if (buckets.size >= MAX_BUCKETS) {
    // Still full: drop half with earliest resetAt so we keep accepting traffic.
    const byReset = [...buckets.entries()].sort(
      (a, b) => a[1].resetAt - b[1].resetAt,
    );
    const drop = Math.ceil(byReset.length / 2);
    for (let i = 0; i < drop; i++) {
      buckets.delete(byReset[i]![0]);
    }
  }
}

/**
 * Consume one token from `key`'s window. Returns true if allowed, false if
 * the limit is already exhausted for this window.
 */
export function takeToken(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/** @internal Test-only: clear process-local buckets between cases. */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}
