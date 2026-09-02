type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < 60_000) {
    return;
  }

  lastCleanup = now;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function rateLimit(
  key: string,
  options: RateLimitOptions
) {
  const now = Date.now();

  cleanup(now);

  const safeKey = key.slice(0, 300);

  const existing = buckets.get(safeKey);

  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = {
      count: 1,
      resetAt: now + options.windowMs
    };

    buckets.set(safeKey, bucket);

    return {
      allowed: true,
      limit: options.limit,
      remaining: Math.max(options.limit - 1, 0),
      resetAt: bucket.resetAt
    };
  }

  existing.count += 1;

  return {
    allowed: existing.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(
      options.limit - existing.count,
      0
    ),
    resetAt: existing.resetAt
  };
}

export function resetRateLimit(key: string) {
  buckets.delete(key.slice(0, 300));
}

export function getRateLimitKey(
  prefix: string,
  identifier: string
) {
  return `${prefix}:${identifier}`.slice(0, 300);
}
