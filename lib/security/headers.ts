export function securityHeaders(
  requestId?: string
) {
  const headers: Record<
    string,
    string
  > = {
    'Cache-Control':
      'no-store',
    'X-Content-Type-Options':
      'nosniff',
    'X-Frame-Options':
      'DENY',
    'Referrer-Policy':
      'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy':
      'same-origin',
    'Cross-Origin-Resource-Policy':
      'same-origin'
  };

  if (requestId) {
    headers['X-Request-ID'] =
      requestId;
  }

  return headers;
}
