type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  key: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export class RateLimitError extends Error {
  public readonly status = 429 as const;
  public readonly retryAfterSeconds: number;

  constructor(
    message = 'Too many requests. Please try again later.',
    retryAfterSeconds = 1
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const buckets = new Map<string, RateLimitBucket>();

const MAX_BUCKETS = 10000;

const CLEANUP_INTERVAL_MS = 60 * 1000;

let lastCleanupAt = 0;

function now(): number {
  return Date.now();
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .slice(0, 500);
}

function normalizeLimit(limit: number): number {
  if (
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return 1;
  }

  return Math.floor(limit);
}

function normalizeWindow(windowMs: number): number {
  if (
    !Number.isFinite(windowMs) ||
    windowMs <= 0
  ) {
    return 60 * 1000;
  }

  return Math.floor(windowMs);
}

function cleanupExpiredBuckets(currentTime: number): void {
  if (
    currentTime - lastCleanupAt <
    CLEANUP_INTERVAL_MS
  ) {
    return;
  }

  lastCleanupAt = currentTime;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= currentTime) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  const entries = Array.from(
    buckets.entries()
  ).sort(
    (a, b) =>
      a[1].resetAt - b[1].resetAt
  );

  const removeCount =
    buckets.size - MAX_BUCKETS;

  for (let index = 0; index < removeCount; index += 1) {
    buckets.delete(entries[index][0]);
  }
}

export function checkRateLimit(
  options: RateLimitOptions
): RateLimitResult {
  const currentTime = now();

  cleanupExpiredBuckets(currentTime);

  const key = normalizeKey(options.key);
  const limit = normalizeLimit(options.limit);
  const windowMs = normalizeWindow(
    options.windowMs
  );

  if (!key) {
    throw new RateLimitError(
      'A rate-limit key is required.',
      1
    );
  }

  const existing = buckets.get(key);

  if (
    !existing ||
    existing.resetAt <= currentTime
  ) {
    const resetAt =
      currentTime + windowMs;

    buckets.set(key, {
      count: 1,
      resetAt
    });

    return {
      success: true,
      limit,
      remaining: Math.max(limit - 1, 0),
      resetAt,
      retryAfterSeconds: Math.ceil(
        windowMs / 1000
      )
    };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (existing.resetAt - currentTime) /
          1000
      )
    );

    return {
      success: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds
    };
  }

  existing.count += 1;

  return {
    success: true,
    limit,
    remaining: Math.max(
      limit - existing.count,
      0
    ),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil(
        (existing.resetAt - currentTime) /
          1000
      )
    )
  };
}

export function enforceRateLimit(
  options: RateLimitOptions
): RateLimitResult {
  const result =
    checkRateLimit(options);

  if (!result.success) {
    throw new RateLimitError(
      'Too many requests. Please wait before trying again.',
      result.retryAfterSeconds
    );
  }

  return result;
}

export function rateLimitResponse(
  error: RateLimitError
): Response {
  return Response.json(
    {
      error: 'RATE_LIMITED',
      message: error.message,
      retryAfterSeconds:
        error.retryAfterSeconds
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(
          error.retryAfterSeconds
        )
      }
    }
  );
}

export function getRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(
      result.limit
    ),
    'X-RateLimit-Remaining': String(
      result.remaining
    ),
    'X-RateLimit-Reset': String(
      Math.ceil(result.resetAt / 1000)
    )
  };
}

export function createUserRateLimitKey(
  userId: string,
  action: string
): string {
  const normalizedUserId =
    typeof userId === 'string'
      ? userId.trim()
      : '';

  const normalizedAction =
    typeof action === 'string'
      ? action.trim().toLowerCase()
      : '';

  if (
    !normalizedUserId ||
    !normalizedAction
  ) {
    throw new Error(
      'Both userId and action are required.'
    );
  }

  return `user:${normalizedUserId}:${normalizedAction}`;
}

export function createIpRateLimitKey(
  ipAddress: string,
  action: string
): string {
  const normalizedIp =
    typeof ipAddress === 'string'
      ? ipAddress.trim()
      : '';

  const normalizedAction =
    typeof action === 'string'
      ? action.trim().toLowerCase()
      : '';

  if (
    !normalizedIp ||
    !normalizedAction
  ) {
    throw new Error(
      'Both ipAddress and action are required.'
    );
  }

  return `ip:${normalizedIp}:${normalizedAction}`;
}

export function getClientIp(
  request: Request
): string {
  const forwardedFor =
    request.headers.get(
      'x-forwarded-for'
    );

  if (forwardedFor) {
    const firstIp =
      forwardedFor
        .split(',')
        .map((value) => value.trim())
        .find(Boolean);

    if (firstIp) {
      return firstIp.slice(0, 100);
    }
  }

  const realIp =
    request.headers.get(
      'x-real-ip'
    );

  if (realIp) {
    return realIp
      .trim()
      .slice(0, 100);
  }

  return 'unknown';
}

export function resetRateLimit(
  key: string
): void {
  const normalizedKey =
    typeof key === 'string'
      ? key.trim()
      : '';

  if (!normalizedKey) {
    return;
  }

  buckets.delete(
    normalizedKey
  );
}

export function clearAllRateLimits(): void {
  buckets.clear();
  lastCleanupAt = now();
}

export const RATE_LIMITS = {
  chat: {
    limit: 30,
    windowMs: 60 * 1000
  },
  chatBurst: {
    limit: 8,
    windowMs: 10 * 1000
  },
  fileUpload: {
    limit: 20,
    windowMs: 60 * 60 * 1000
  },
  search: {
    limit: 30,
    windowMs: 60 * 1000
  },
  deepResearch: {
    limit: 5,
    windowMs: 60 * 60 * 1000
  },
  accountAction: {
    limit: 10,
    windowMs: 60 * 60 * 1000
  },
  auth: {
    limit: 10,
    windowMs: 15 * 60 * 1000
  }
} as const;
