import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const NORMAL_API_LIMIT = 60;
const SENSITIVE_API_LIMIT = 12;

function createRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
  }
}

function getClientIp(req: NextRequest) {
  const forwarded =
    req.headers
      .get('x-forwarded-for')
      ?.split(',')[0]
      ?.trim();

  const realIp =
    req.headers.get('x-real-ip')?.trim();

  return (
    forwarded ||
    realIp ||
    'unknown'
  ).slice(0, 100);
}

function isPublicApi(pathname: string) {
  return (
    pathname === '/api/health' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/share/') ||
    pathname === '/api/security/rate-limit' ||
    pathname === '/api/security/request-id'
  );
}

function isSensitiveApi(pathname: string) {
  return (
    pathname.startsWith('/api/chat') ||
    pathname.startsWith('/api/files/upload') ||
    pathname.startsWith('/api/account/') ||
    pathname.startsWith('/api/auth/')
  );
}

function consumeRateLimit(
  key: string,
  limit: number
) {
  const now = Date.now();

  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
  }

  const existing = buckets.get(key);

  if (
    !existing ||
    existing.resetAt <= now
  ) {
    const bucket = {
      count: 1,
      resetAt: now + WINDOW_MS
    };

    buckets.set(key, bucket);

    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      resetAt: bucket.resetAt
    };
  }

  existing.count += 1;

  return {
    allowed: existing.count <= limit,
    remaining: Math.max(
      limit - existing.count,
      0
    ),
    resetAt: existing.resetAt
  };
}

function applySecurityHeaders(
  response: NextResponse,
  requestId: string
) {
  response.headers.set(
    'X-Request-ID',
    requestId
  );

  response.headers.set(
    'X-Content-Type-Options',
    'nosniff'
  );

  response.headers.set(
    'X-Frame-Options',
    'DENY'
  );

  response.headers.set(
    'Referrer-Policy',
    'strict-origin-when-cross-origin'
  );

  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  response.headers.set(
    'Cross-Origin-Opener-Policy',
    'same-origin'
  );

  response.headers.set(
    'Cross-Origin-Resource-Policy',
    'same-origin'
  );

  return response;
}

function invalidOrigin(
  requestId: string
) {
  return applySecurityHeaders(
    NextResponse.json(
      {
        error: 'Invalid request origin.'
      },
      {
        status: 403
      }
    ),
    requestId
  );
}

export default withAuth(
  function middleware(
    req: NextRequest
  ) {
    const requestId =
      createRequestId();

    const pathname =
      req.nextUrl.pathname;

    /*
     * Protect state-changing API requests
     * against cross-origin requests.
     */
    if (
      pathname.startsWith('/api/') &&
      !isPublicApi(pathname) &&
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      req.method !== 'OPTIONS'
    ) {
      const origin =
        req.headers.get('origin');

      if (origin) {
        try {
          const originUrl =
            new URL(origin);

          const host =
            req.headers.get('host');

          if (
            !host ||
            originUrl.host !== host
          ) {
            return invalidOrigin(
              requestId
            );
          }
        } catch {
          return invalidOrigin(
            requestId
          );
        }
      }
    }

    /*
     * Global API rate limiting.
     */
    if (pathname.startsWith('/api/')) {
      const ip = getClientIp(req);

      const sensitive =
        isSensitiveApi(pathname);

      const limit = sensitive
        ? SENSITIVE_API_LIMIT
        : NORMAL_API_LIMIT;

      const result =
        consumeRateLimit(
          `${ip}:${sensitive ? 'sensitive' : 'normal'}`,
          limit
        );

      if (!result.allowed) {
        const retryAfter =
          Math.max(
            Math.ceil(
              (result.resetAt -
                Date.now()) /
                1000
            ),
            1
          );

        const response =
          NextResponse.json(
            {
              error:
                'Too many requests. Please try again later.',
              retryAfter
            },
            {
              status: 429
            }
          );

        response.headers.set(
          'Retry-After',
          String(retryAfter)
        );

        response.headers.set(
          'X-RateLimit-Limit',
          String(limit)
        );

        response.headers.set(
          'X-RateLimit-Remaining',
          String(result.remaining)
        );

        response.headers.set(
          'X-RateLimit-Reset',
          String(
            Math.ceil(
              result.resetAt / 1000
            )
          )
        );

        return applySecurityHeaders(
          response,
          requestId
        );
      }
    }

    const response =
      NextResponse.next();

    return applySecurityHeaders(
      response,
      requestId
    );
  },
  {
    pages: {
      signIn: '/login'
    },

    callbacks: {
      authorized: ({
        token,
        req
      }) => {
        const pathname =
          req.nextUrl.pathname;

        /*
         * Public endpoints.
         */
        if (
          pathname.startsWith(
            '/api/auth/'
          ) ||
          pathname === '/api/health' ||
          pathname.startsWith(
            '/api/share/'
          ) ||
          pathname ===
            '/api/security/rate-limit' ||
          pathname ===
            '/api/security/request-id'
        ) {
          return true;
        }

        return !!token;
      }
    }
  }
);

export const config = {
  matcher: [
    '/',
    '/c/:path*',
    '/settings/:path*',
    '/projects/:path*',
    '/agents/:path*',
    '/library/:path*',
    '/search/:path*',
    '/api/:path*'
  ]
};
