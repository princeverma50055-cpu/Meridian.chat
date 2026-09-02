export function securityHeaders(
  requestId?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };

  if (requestId) {
    headers['X-Request-ID'] = requestId;
  }

  return headers;
}

export function mergeSecurityHeaders(
  base: HeadersInit | undefined,
  requestId?: string
): Headers {
  const headers = new Headers(base);

  for (const [key, value] of Object.entries(
    securityHeaders(requestId)
  )) {
    headers.set(key, value);
  }

  return headers;
}
